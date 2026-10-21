# 突破夜盘高低点：今天日盘有没有突破当天夜盘的最高点 / 最低点
# 输入：清洗后的 ES 1 分钟 K 线（Databento ES.c.0，时间是 UTC）
import numpy as np
import pandas as pd

df = pd.read_csv("ES-1min_标准版.csv", usecols=["ts_event", "high", "low"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
df["date"] = t.dt.normalize()
is_rth = (hm >= 930) & (hm < 1615)                    # 日盘 09:30–16:15

rth = df[is_rth].groupby("date").agg(hi=("high", "max"), lo=("low", "min"))
days = rth.index

# 夜盘 = 前一个交易日 16:15 到当天 09:29：
# 16:15 之后的 K 线归到下一个交易日，09:30 之前的归到当天
eth = df[~is_rth]
anchor = eth.date + pd.to_timedelta((hm[~is_rth] >= 1615).astype(int), unit="D")
pos = days.searchsorted(anchor)
keep = pos < len(days)
night = (eth[keep].assign(day=days[pos[keep]])
         .groupby("day").agg(hi=("high", "max"), lo=("low", "min"), bars=("high", "size")))
night = night[night.bars >= 800]                      # 夜盘不完整（少于 800 根）的日子跳过

today = rth.loc[night.index]
up = today.hi > night.hi                              # 严格高于，等于不算
down = today.lo < night.lo
cls = pd.Series(np.select([up & down, up, down], ["两边都破", "只破上", "只破下"], "都没破"), index=today.index)

print("样本天数", len(cls))
print((cls.value_counts(normalize=True) * 100).round(1).to_string())
print("至少破一侧 %.1f%%" % (100 * (cls != "都没破").mean()))

# 夜盘区间的宽度：除以过去 8 天日盘的平均波幅（不含今天），开盘前就能算出来
adr = (rth.hi - rth.lo).rolling(8).mean().shift(1).loc[night.index]
ok = adr.notna()                                      # 数据最开始的 8 天没有平均波幅，跳过
width = ((night.hi - night.lo) / adr * 100)[ok]
groups = pd.cut(width, [0, 30, 40, 50, 60, 70, 80, 100, 120, np.inf], right=False)
print(f"\n夜盘宽度：{ok.sum()} 天，中位数 {width.median():.1f}%，中间一半 {width.quantile(0.25):.1f}%–{width.quantile(0.75):.1f}%")
tab = pd.crosstab(groups, cls[ok], normalize="index").mul(100).round(1)
tab["天数"] = groups.value_counts().sort_index()
print(tab.to_string())
narrow, wide = cls[ok][width < 50], cls[ok][width >= 100]       # 不到平均日波幅一半 / 超过一整个平均日波幅
print(f"夜盘宽度 < 50%：{len(narrow)} 天，两边都破 {100 * (narrow == '两边都破').mean():.1f}%；"
      f"≥ 100%：{len(wide)} 天，两边都破 {100 * (wide == '两边都破').mean():.1f}%，都没破 {100 * (wide == '都没破').mean():.1f}%")
