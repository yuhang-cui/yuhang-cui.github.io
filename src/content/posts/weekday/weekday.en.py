# Day-of-week effect: from Monday to Friday, do ES's RTH up-day share, daily change and intraday range differ?
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
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]

df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "instrument_id", "open", "high", "low", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
rth = df[(hm >= 930) & (hm < 1615)].assign(date=t.dt.normalize())   # RTH 09:30–16:15
day = rth.groupby("date").agg(o=("open", "first"), h=("high", "max"), l=("low", "min"), c=("close", "last"),
                              contract=("instrument_id", "first"))

# Close to close: yesterday = the previous stock market trading day; skip the day if yesterday was removed in cleaning or the contracts differ
cal = pd.bdate_range(day.index.min() - pd.Timedelta(days=10), day.index.max())
cal = cal[~cal.isin(NYSE().holidays(cal.min(), cal.max()).union(CLOSED))]
prev = pd.Series(cal[:-1], index=cal[1:]).reindex(day.index)
linked = (prev.values[1:] == day.index.values[:-1]) & (day.contract.values[1:] == day.contract.values[:-1])

day["rth"] = (day.c - day.o) / day.o * 100                                   # RTH change, %
day["c2c"] = np.r_[np.nan, np.where(linked, (day.c.values[1:] / day.c.values[:-1] - 1) * 100, np.nan)]
day["range"] = (day.h - day.l) / day.o * 100                                 # intraday range, %
day["weekday"] = day.index.dayofweek                                         # 0 = Monday … 4 = Friday


def wilson(k, n, z=1.96):
    """95% interval for the up-day share (Wilson method)"""
    p = k / n
    c = (p + z * z / (2 * n)) / (1 + z * z / n)
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return f"{100 * (c - h):.1f}–{100 * (c + h):.1f}"


def table(d):
    g = d.groupby("weekday")
    tab = pd.DataFrame({
        "days": g.size(),
        "RTH up %": g["rth"].apply(lambda s: 100 * (s > 0).mean()),
        "95% interval": g["rth"].apply(lambda s: wilson((s > 0).sum(), len(s))),
        "c2c up %": g["c2c"].apply(lambda s: 100 * (s.dropna() > 0).mean()),
        "c2c mean %": g["c2c"].mean(),
        "c2c median %": g["c2c"].median(),
        "median range %": g["range"].median(),
    }).round(3)
    tab.index = DAYS
    return tab


print(f"Sample {len(day)} days; RTH up {100 * (day['rth'] > 0).mean():.1f}%, "
      f"up close to close {100 * (day['c2c'].dropna() > 0).mean():.1f}%, median range {day['range'].median():.2f}%")
print(table(day).to_string())
for a, b in [(2010, 2017), (2018, 2026)]:                                   # check each half separately to see if it holds up
    print(f"\n{a}–{b}")
    print(table(day[(day.index.year >= a) & (day.index.year <= b)]).to_string())

# Week, month and quarter ends: month end = the last stock market trading day of each month (months where that day was removed don't count); quarter end = month end in March, June, September, December
last_day = pd.Series(cal, index=cal).groupby([cal.year, cal.month]).max()
day["month_end"] = day.index.isin(last_day.values)
day["quarter_end"] = day["month_end"] & day.index.month.isin([3, 6, 9, 12])
print()
for name, m in [("All days", day.index == day.index), ("Friday", day["weekday"] == 4), ("Month end", day["month_end"]), ("Quarter end", day["quarter_end"])]:
    s = day[m]
    cc = s["c2c"].dropna()
    print(f"{name}: {len(s)} days, RTH up {100 * (s['rth'] > 0).mean():.1f}% (95% interval {wilson((s['rth'] > 0).sum(), len(s))}), "
          f"up close to close {100 * (cc > 0).mean():.1f}% (95% interval {wilson((cc > 0).sum(), len(cc))})")
print("\nThe 5 biggest close-to-close drops:")
print(day["c2c"].nsmallest(5).round(2).to_string())
