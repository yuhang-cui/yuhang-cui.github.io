# How many of yesterday's ranges today travels: use yesterday's RTH range as a ruler, measuring up from yesterday's high and down from yesterday's low
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

df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "instrument_id", "open", "high", "low", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
rth = df[(hm >= 930) & (hm < 1615)].assign(date=t.dt.normalize())  # RTH 09:30–16:15
day = rth.groupby("date").agg(o=("open", "first"), h=("high", "max"), l=("low", "min"), c=("close", "last"),
                              contract=("instrument_id", "first"))

# Yesterday = the previous stock market trading day; skip today if yesterday was removed in cleaning or the two days are on different contracts (same as the prior-day breakout post)
cal = pd.bdate_range(day.index.min() - pd.Timedelta(days=10), day.index.max())
cal = cal[~cal.isin(NYSE().holidays(cal.min(), cal.max()).union(CLOSED))]
prev = pd.Series(cal[:-1], index=cal[1:]).reindex(day.index)
today = day[prev.isin(day.index)]
yday = day.loc[prev[today.index]].set_index(today.index)
same = today.contract == yday.contract
today, yday = today[same], yday[same]

# Convert to whole ticks (0.25 points) before comparing, to avoid floating-point errors
tick = lambda x: np.round(x * 4).astype(int)
R = tick(yday.h - yday.l)                                   # yesterday's range
up = tick(today.h - yday.h)                                 # how far today's high went above yesterday's high
dn = tick(yday.l - today.l)                                 # how far today's low went below yesterday's low


def hit(x, k):
    """Reached k × yesterday's range: 0× must be a strict break (at least 1 tick); for k > 0, x ≥ k × R"""
    return x > 0 if k == 0 else x * 20 >= round(k * 20) * R


print(f"Sample {len(R)} days")
for k in [0, 0.5, 0.8, 1, 2]:
    u, d = hit(up, k), hit(dn, k)
    print(f"{k}×: above {100 * u.mean():.1f}%  below {100 * d.mean():.1f}%  either side {100 * (u | d).mean():.1f}%")

# From which multiple does "reached below" overtake "reached above" (checked every 0.05×)
cross = next(k / 20 for k in range(1, 41) if hit(dn, k / 20).mean() > hit(up, k / 20).mean())
print(f"From {cross}× on, below beats above")
# Share reaching 1× after a break: only days that broke yesterday's high (low)
print(f"Days that broke above: {100 * hit(up, 1)[hit(up, 0)].mean():.1f}% reached 1×; days that broke below: {100 * hit(dn, 1)[hit(dn, 0)].mean():.1f}%")

# Groups: yesterday up / down; which third of the range yesterday closed in; where today opened relative to yesterday's range
ibs = (yday.c - yday.l) / (yday.h - yday.l)                # where yesterday closed in its range, 0 = low, 1 = high
loc = (today.o - yday.l) / (yday.h - yday.l)               # where today opened in yesterday's range, > 1 = above yesterday's high
groups = {
    "Yesterday up": yday.c > yday.o, "Yesterday down": yday.c < yday.o,
    "Closed top third": ibs >= 2 / 3, "Closed middle third": (ibs > 1 / 3) & (ibs < 2 / 3), "Closed bottom third": ibs <= 1 / 3,
    "Opened above yesterday's high": loc > 1, "Opened top third": (loc >= 2 / 3) & (loc <= 1), "Opened middle third": (loc > 1 / 3) & (loc < 2 / 3),
    "Opened bottom third": (loc >= 0) & (loc <= 1 / 3), "Opened below yesterday's low": loc < 0,
}
flags = pd.DataFrame({"0.5x up": hit(up, 0.5), "0.5x down": hit(dn, 0.5), "1x up": hit(up, 1), "1x down": hit(dn, 1),
                      "0x either": hit(up, 0) | hit(dn, 0), "0.5x either": hit(up, 0.5) | hit(dn, 0.5), "1x either": hit(up, 1) | hit(dn, 1)})
rows = {}
for name, m in groups.items():
    rows[name] = {"days": m.sum(), **flags[m].mean()}
print(pd.DataFrame(rows).T.round(3).to_string())
