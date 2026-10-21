# Gap fill: does this week (today) trade back to last week's (yesterday's) close?
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
EDGES = [0, 5, 10, 15, 20, 30, 50, 100, np.inf]                                   # gap-size buckets (% of average range)

df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "instrument_id", "open", "high", "low", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
rth = df[(hm >= 930) & (hm < 1615)].assign(date=t.dt.normalize(), h1=hm < 1030)   # RTH 09:30–16:15
g = rth.groupby("date")
day = g.agg(o=("open", "first"), h=("high", "max"), l=("low", "min"), c=("close", "last"), inst=("instrument_id", "first"))
first_hour = rth[rth.h1].groupby("date").agg(h=("high", "max"), l=("low", "min"))  # first hour of RTH, 09:30–10:30


def report(name, gaps):
    gaps["bucket"] = pd.cut(gaps["size"], EDGES, right=False)
    print(f"== {name}: {len(gaps)} gaps, filled in the same period {100 * gaps['filled'].mean():.1f}%, "
          f"filled right away {100 * gaps['early'].mean():.1f}%")
    by_dir = gaps.groupby("up")["filled"].mean() * 100
    print(f"Gap up {by_dir[True]:.1f}%, gap down {by_dir[False]:.1f}%")
    print(gaps.groupby("bucket", observed=True).agg(gaps=("filled", "size"), filled=("filled", "mean"), early=("early", "mean")).round(3).to_string())


# —— Weekly: this week's open vs last week's close ——
day["wk"] = day.index - pd.to_timedelta(day.index.dayofweek, unit="D")   # Monday of this week
weeks = []
for wk, d in day.groupby("wk"):
    d = d[d.inst == d.inst.iloc[0]]          # if the contract rolls mid-week, ignore the days after the roll
    weeks.append(dict(wk=wk, d=d, o=d.o.iloc[0], c=d.c.iloc[-1], rng=d.h.max() - d.l.min(),
                      i0=d.inst.iloc[0], i1=d.inst.iloc[-1]))
rows = []
for i in range(8, len(weeks)):
    a, b = weeks[i - 1], weeks[i]
    if (b["wk"] - a["wk"]).days != 7 or a["i1"] != b["i0"]:
        continue                             # last week is missing, or the two weeks are on different contracts
    gap = b["o"] - a["c"]
    if gap == 0:
        continue
    abr = np.mean([w["rng"] for w in weeks[i - 8:i]])   # average weekly range over the last 8 weeks
    hit = (b["d"].l <= a["c"]) if gap > 0 else (b["d"].h >= a["c"])   # which days traded back to last week's close
    rows.append({"up": gap > 0, "size": abs(gap) / abr * 100, "filled": hit.any(), "early": hit.iloc[0]})
report("Weekly", pd.DataFrame(rows))

# —— Daily: today's open vs yesterday's close (yesterday = the previous stock market trading day) ——
cal = pd.bdate_range(day.index.min() - pd.Timedelta(days=10), day.index.max())
cal = cal[~cal.isin(NYSE().holidays(cal.min(), cal.max()).union(CLOSED))]
prev = pd.Series(cal[:-1], index=cal[1:]).reindex(day.index)
adr = (day.h - day.l).rolling(8).mean().shift(1)        # average daily range over the last 8 days
rows = []
for i in range(8, len(day)):
    today, yday = day.iloc[i], day.iloc[i - 1]
    if prev.iloc[i] != day.index[i - 1] or today.inst != yday.inst:
        continue                             # yesterday was removed in cleaning, or the two days are on different contracts
    gap = today.o - yday.c
    if gap == 0:
        continue
    fh = first_hour.loc[day.index[i]]
    up = gap > 0
    rows.append({"up": up, "size": abs(gap) / adr.iloc[i] * 100,
                 "filled": today.l <= yday.c if up else today.h >= yday.c,
                 "early": fh.l <= yday.c if up else fh.h >= yday.c})
report("Daily", pd.DataFrame(rows))
