import React from 'react';

const AnimatedNumber = ({ value, prefix = '', suffix = '', decimals = 0, className = '' }) => {
  return (
    <span className={`font-mono font-bold tracking-tight ${className}`}>
      {prefix}
      {Number(value).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
};

export default AnimatedNumber;
