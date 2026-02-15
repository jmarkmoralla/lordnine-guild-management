export const PHILIPPINES_TIME_ZONE = 'Asia/Manila';
export const PHILIPPINES_OFFSET = '+08:00';
export const PHILIPPINES_DISPLAY_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: PHILIPPINES_TIME_ZONE,
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

export const PHILIPPINES_DISPLAY_DAYTIME_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: PHILIPPINES_TIME_ZONE,
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

export const getPhilippinesNowParts = () => {
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: PHILIPPINES_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  return {
    year: parts.find((part) => part.type === 'year')?.value ?? '1970',
    month: parts.find((part) => part.type === 'month')?.value ?? '01',
    day: parts.find((part) => part.type === 'day')?.value ?? '01',
    hour: parts.find((part) => part.type === 'hour')?.value ?? '00',
    minute: parts.find((part) => part.type === 'minute')?.value ?? '00',
    second: parts.find((part) => part.type === 'second')?.value ?? '00',
  };
};

export const getPhilippinesNowDate = () => {
  const { year, month, day, hour, minute, second } = getPhilippinesNowParts();
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${PHILIPPINES_OFFSET}`);
};

export const getPhilippinesNowIsoString = () => {
  const { year, month, day, hour, minute, second } = getPhilippinesNowParts();
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${PHILIPPINES_OFFSET}`;
};

export const formatPhilippinesDisplayDateTime = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-PH', PHILIPPINES_DISPLAY_DATETIME_OPTIONS);

  const parts = formatter.formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';

  return `${month}. ${day}, ${year} - ${hour}:${minute}`;
};

export const formatPhilippinesMonthDayTime = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: PHILIPPINES_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';

  return `${month}/${day} - ${hour}:${minute}`;
};

export const formatPhilippinesMonthDayTime12 = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: PHILIPPINES_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
  const dayPeriod = (parts.find((part) => part.type === 'dayPeriod')?.value ?? '').toUpperCase();

  return `${month}/${day} - ${hour}:${minute} ${dayPeriod}`.trim();
};

export const formatPhilippinesDateTime = formatPhilippinesDisplayDateTime;

export const formatPhilippinesDayTime = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-PH', PHILIPPINES_DISPLAY_DAYTIME_OPTIONS);

  return formatter.format(date);
};

export const formatTimeLabel = (timeValue: string) => {
  const [hoursValue, minutesValue] = timeValue.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
