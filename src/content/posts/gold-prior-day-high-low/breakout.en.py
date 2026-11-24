# Prior-day breakout (gold): did today break yesterday's high / low?
# Input: cleaned 1-minute GC bars (Databento GC.v.0, timestamps in UTC, with an instrument_id column)
import numpy as np
import pandas as pd
from pandas.tseries.holiday import AbstractHolidayCalendar, Holiday, GoodFriday, nearest_workday, sunday_to_monday

NY_ONLY = False  # True: New York session only, 09:30–16:00; today's window against yesterday's window


class GoldClosed(AbstractHolidayCalendar):  # gold full-day closures
    rules = [
        Holiday("New Year's Day", month=1, day=1, observance=sunday_to_monday),
        GoodFriday,
        Holiday("Christmas", month=12, day=25, observance=nearest_workday),
    ]


df = pd.read_csv("GC-1min_clean.csv", usecols=["ts_event", "instrument_id", "high", "low"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
df["date"] = t.dt.normalize() + pd.to_timedelta((hm >= 1800).astype(int), unit="D")  # bars after 18:00 belong to the next trading day
if NY_ONLY:
    df = df[(hm >= 930) & (hm < 1600)]
day = df.groupby("date").agg(hi=("high", "max"), lo=("low", "min"), contract=("instrument_id", "first"))

# Yesterday = the previous gold trading day (Monday to Friday, minus New Year's Day, Good Friday and Christmas)
cal = pd.bdate_range(day.index.min() - pd.Timedelta(days=10), day.index.max())
cal = cal[~cal.isin(GoldClosed().holidays(cal.min(), cal.max()))]
prev = pd.Series(cal[:-1], index=cal[1:]).reindex(day.index)

today = day[prev.isin(day.index)]                     # yesterday must also be in the cleaned data, else skip
yday = day.loc[prev[today.index]].set_index(today.index)
same = today.contract == yday.contract                # both days must be the same contract
today, yday = today[same], yday[same]

up = today.hi > yday.hi                               # strictly above; equal doesn't count
down = today.lo < yday.lo
cls = pd.Series(np.select([up & down, up, down], ["both sides", "up only", "down only"], "neither"), index=today.index)

print("sample days", len(cls))
print((cls.value_counts(normalize=True) * 100).round(1).to_string())
print("at least one side %.1f%%, high broken %.1f%%, low broken %.1f%%" % (100 * (cls != "neither").mean(), 100 * up.mean(), 100 * down.mean()))
