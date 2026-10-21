# Intraday range: each day's (RTH high − RTH low) ÷ open
# Input: cleaned 1-minute ES bars (Databento ES.c.0, timestamps in UTC, half-day sessions removed)
import pandas as pd

df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "open", "high", "low"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
df["date"] = t.dt.normalize()
rth = df[(hm >= 930) & (hm < 1615)]                   # RTH 09:30–16:15

# The open is the open of the 09:30 bar (the data is sorted by time, so it's the first bar)
day = rth.groupby("date").agg(open=("open", "first"), hi=("high", "max"), lo=("low", "min"))
r = (day.hi - day.lo) / day.open * 100                # range in %

print("Sample size", len(r))
print("Mean %.2f%%  Median %.2f%%" % (r.mean(), r.median()))
print((r.quantile([0.1, 0.25, 0.75, 0.9])).round(2).to_string())
for b in [1, 1.5]:
    print("Under %.1f%%: %.1f%%" % (b, 100 * (r < b).mean()))
for b in [2, 3]:
    print("Over %.0f%%: %.1f%%" % (b, 100 * (r > b).mean()))

by_year = r.groupby(r.index.year).describe(percentiles=[0.25, 0.5, 0.75, 0.9])
print(by_year[["count", "50%", "25%", "75%", "90%", "max"]].round(2).to_string())
print(r.nlargest(5).round(2).to_string())
