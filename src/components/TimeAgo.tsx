import React, { useState, useEffect } from 'react';
import { safeFormatDistanceToNow } from '../lib/dateUtils';

interface TimeAgoProps {
  date: string | Date | null;
  className?: string;
}

export default function TimeAgo({ date, className }: TimeAgoProps) {
  const [timeAgo, setTimeAgo] = useState(() => safeFormatDistanceToNow(date, { addSuffix: true }));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(safeFormatDistanceToNow(date, { addSuffix: true }));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [date]);

  return <span className={className}>{timeAgo}</span>;
}
