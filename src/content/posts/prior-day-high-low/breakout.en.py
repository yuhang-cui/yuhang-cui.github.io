# Prior-day breakout: did today's RTH break yesterday's RTH high / low?
# Input: cleaned 1-minute ES bars (Databento ES.c.0, timestamps in UTC, with an instrument_id column)
import numpy as np
import pandas as pd
from pandas.tseries.holiday import (
    AbstractHolidayCalendar, Holiday, GoodFriday, USMartinLutherKingJr, USPresidentsDay,
    USMemorialDay, USLaborDay, USThanksgivingDay, nearest_workday, sunday_to_monday,
)


class NYSE(AbstractHolidayCalendar):  # NYSE full-day closures
    rules = [
        Holiday("New Year's Day", month=1, day=1, observance=sunday_to_monday),
        USMartinLutherKingJr, USPresidentsDay, GoodFriday, USMemorialDay,
        Holiday("Juneteenth", month=6, day=19, start_date="2022-01-01", observance=nearest_workday),
        Holiday("Independence Day", month=7, day=4, observance=nearest_workday),
        USLaborDay, USThanksgivingDay,
        Holiday("Christmas", month=12, day=25, observance=nearest_workday),
    ]


CLOSED = pd.to_datetime(["2012-10-29", "2012-10-30", "2018-12-05", "2025-01-09"])  # unscheduled closures

df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "instrument_id", "high", "low"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
rth = df[(hm >= 930) & (hm < 1615)].assign(date=t.dt.normalize())  # RTH 09:30–16:15
day = rth.groupby("date").agg(hi=("high", "max"), lo=("low", "min"), contract=("instrument_id", "first"))

# Yesterday = the previous stock market trading day (after a holiday, the last day before it)
cal = pd.bdate_range(day.index.min() - pd.Timedelta(days=10), day.index.max())
cal = cal[~cal.isin(NYSE().holidays(cal.min(), cal.max()).union(CLOSED))]
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
print("at least one side %.1f%%" % (100 * (cls != "neither").mean()))
