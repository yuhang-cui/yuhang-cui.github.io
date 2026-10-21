# After consecutive bull / bear bars: after N bars up (down) in a row, what are the odds the next bar closes up?
# Input: cleaned 1-minute ES bars (Databento ES.c.0, timestamps in UTC)
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

df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "open", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
m = t.dt.hour * 60 + t.dt.minute
# RTH bars: open at 09:30, close at 16:15
rth = df[(m >= 570) & (m < 975)].groupby(t.dt.normalize()).agg(o=("open", "first"), c=("close", "last"))
# Full-day bars: open at 18:00 the evening before, close at 17:00 (anything after 18:00 belongs to the next trading day)
full = df.groupby((t + pd.Timedelta(hours=6)).dt.normalize()).agg(o=("open", "first"), c=("close", "last"))
full = full.loc[rth.index[1:]]      # keep only days with an RTH session; the first day's overnight session is incomplete, so drop it

# On the daily chart, "in a row" follows stock market trading days: if the previous trading day was removed in cleaning, start counting over
cal = pd.bdate_range(rth.index.min() - pd.Timedelta(days=10), rth.index.max())
cal = cal[~cal.isin(NYSE().holidays(cal.min(), cal.max()).union(CLOSED))]
prev = pd.Series(cal[:-1], index=cal[1:])


def wilson(k, n, z=1.96):
    """95% interval for a proportion (Wilson method), more reliable than "rate ± 2 standard errors" with small samples"""
    p = k / n
    c = (p + z * z / (2 * n)) / (1 + z * z / n)
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return f"{100 * (c - h):.1f}%–{100 * (c + h):.1f}%"


def study(bars, linked, name):
    d = np.sign(bars.c.values - bars.o.values).astype(int)   # bull bar +1, bear bar −1, doji 0
    streak = np.zeros(len(d), int)                            # bull streak +1, +2, …; bear streak −1, −2, …
    for i, x in enumerate(d):
        same = i > 0 and linked[i] and x != 0 and np.sign(streak[i - 1]) == x
        streak[i] = streak[i - 1] + x if same else x
    rows = pd.DataFrame({"streak": streak[:-1], "next_up": d[1:] > 0})[(d[1:] != 0) & linked[1:]]   # skip when the next bar is a doji or isn't adjacent
    rows["group"] = rows["streak"].clip(-8, 8)                # 8 or more in a row go into one group
    print(f"== {name}: {len(rows)} cases, next bar closes up {100 * rows['next_up'].mean():.1f}% unconditionally")
    for lab, g in [("After 2+ bull bars", rows[rows["streak"] >= 2]), ("After 2+ bear bars", rows[rows["streak"] <= -2])]:
        print(f"{lab}: {len(g)} cases, next bar closes up {100 * g['next_up'].mean():.1f}% (95% interval {wilson(g['next_up'].sum(), len(g))})")
    tab = rows[rows["group"] != 0].groupby("group")["next_up"].agg(["size", "mean", "sum"])
    tab["95% interval"] = [wilson(k, n) for k, n in zip(tab["sum"], tab["size"])]
    tab.index = [f"{abs(k)}{'+' if abs(k) == 8 else ''} {'bull' if k > 0 else 'bear'} in a row" for k in tab.index]
    print(tab.drop(columns="sum").rename(columns={"size": "cases", "mean": "next up"}).round(3).to_string())


for bars, name in [(rth, "Daily · RTH"), (full, "Daily · full day")]:
    study(bars, np.r_[False, prev.reindex(bars.index).values[1:] == bars.index.values[:-1]], name)
    wk = bars.index - pd.to_timedelta(bars.index.dayofweek, unit="D")              # Monday of the week
    w = bars.groupby(wk).agg(o=("o", "first"), c=("c", "last"))
    study(w, np.r_[False, np.diff(w.index.values) == np.timedelta64(7, "D")], name.replace("Daily", "Weekly"))
