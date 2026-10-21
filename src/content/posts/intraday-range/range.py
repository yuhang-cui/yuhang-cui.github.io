# 日内波幅：每天日盘的（最高价 − 最低价）÷ 开盘价
# 输入：清洗后的 ES 1 分钟 K 线（Databento ES.c.0，时间是 UTC，半日市已删）
import pandas as pd

df = pd.read_csv("ES-1min_标准版.csv", usecols=["ts_event", "open", "high", "low"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
df["date"] = t.dt.normalize()
rth = df[(hm >= 930) & (hm < 1615)]                   # 日盘 09:30–16:15

# 开盘价取 09:30 那根的开盘价（数据按时间排好，第一根就是 09:30）
day = rth.groupby("date").agg(open=("open", "first"), hi=("high", "max"), lo=("low", "min"))
r = (day.hi - day.lo) / day.open * 100                # 波幅 %

print("样本天数", len(r))
print("平均 %.2f%%  中位数 %.2f%%" % (r.mean(), r.median()))
print((r.quantile([0.1, 0.25, 0.75, 0.9])).round(2).to_string())
for b in [1, 1.5]:
    print("小于 %.1f%%：%.1f%%" % (b, 100 * (r < b).mean()))
for b in [2, 3]:
    print("大于 %.0f%%：%.1f%%" % (b, 100 * (r > b).mean()))

by_year = r.groupby(r.index.year).describe(percentiles=[0.25, 0.5, 0.75, 0.9])
print(by_year[["count", "50%", "25%", "75%", "90%", "max"]].round(2).to_string())
print(r.nlargest(5).round(2).to_string())
