import os
import json
import redis
import logging
from .database import SessionLocal
from .models import EventLog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STREAM_NAME = "disaster_events"

class EventBus:
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    
    def publish(self, event_type: str, payload: dict):
        try:
            # 1. Write to Postgres event_log
            db = SessionLocal()
            log_entry = EventLog(
                service_name=self.service_name,
                event_type=event_type,
                payload=payload
            )
            db.add(log_entry)
            db.commit()
            db.close()
            
            # 2. Publish to Redis Stream
            self.redis_client.xadd(STREAM_NAME, {"payload": json.dumps(payload)})
            logger.info(f"[{self.service_name}] Published {event_type} to stream")
        except Exception as e:
            logger.error(f"[{self.service_name}] Error publishing event: {e}")

    def consume(self, group_name: str, consumer_name: str, callback_map: dict):
        # Create consumer group if not exists
        try:
            self.redis_client.xgroup_create(STREAM_NAME, group_name, id='0', mkstream=True)
        except redis.exceptions.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                logger.error(f"Error creating group: {e}")
                
        last_id = ">"
        logger.info(f"[{self.service_name}] Started consuming as {consumer_name} in group {group_name}")
        while True:
            try:
                messages = self.redis_client.xreadgroup(group_name, consumer_name, {STREAM_NAME: last_id}, count=10, block=2000)
                if not messages:
                    continue
                
                for stream, msgs in messages:
                    for msg_id, msg_data in msgs:
                        try:
                            payload_str = msg_data.get("payload")
                            if payload_str:
                                payload = json.loads(payload_str)
                                event_type = payload.get("event")
                                
                                if event_type in callback_map:
                                    callback_map[event_type](payload)
                                    
                        except Exception as e:
                            logger.error(f"[{self.service_name}] Error processing message {msg_id}: {e}")
                        finally:
                            # Acknowledge message
                            self.redis_client.xack(STREAM_NAME, group_name, msg_id)
            except Exception as e:
                logger.error(f"[{self.service_name}] Redis error: {e}")
                import time
                time.sleep(1)
