# 突破昨日高低点（黄金）：今天有没有突破昨天的最高点 / 最低点
# 输入：清洗后的 GC 1 分钟 K 线（Databento GC.v.0，时间是 UTC，含 instrument_id 列）
import numpy as np
import pandas as pd
from pandas.tseries.holiday import AbstractHolidayCalendar, Holiday, GoodFriday, nearest_workday, sunday_to_monday

NY_ONLY = False  # True：只看纽约时段 09:30–16:00，今天这一段对昨天这一段


class GoldClosed(AbstractHolidayCalendar):  # 黄金全天休市日
    rules = [
        Holiday("元旦", month=1, day=1, observance=sunday_to_monday),
        GoodFriday,
        Holiday("圣诞节", month=12, day=25, observance=nearest_workday),
    ]


df = pd.read_csv("GC-1min_标准版.csv", usecols=["ts_event", "instrument_id", "high", "low"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
df["date"] = t.dt.normalize() + pd.to_timedelta((hm >= 1800).astype(int), unit="D")  # 18:00 之后算第二天的交易日
if NY_ONLY:
    df = df[(hm >= 930) & (hm < 1600)]
day = df.groupby("date").agg(hi=("high", "max"), lo=("low", "min"), contract=("instrument_id", "first"))

# 昨天 = 上一个黄金交易日（周一到周五，去掉元旦、耶稣受难日、圣诞）
cal = pd.bdate_range(day.index.min() - pd.Timedelta(days=10), day.index.max())
cal = cal[~cal.isin(GoldClosed().holidays(cal.min(), cal.max()))]
prev = pd.Series(cal[:-1], index=cal[1:]).reindex(day.index)

today = day[prev.isin(day.index)]                     # 昨天也必须在清洗后的数据里，否则跳过
yday = day.loc[prev[today.index]].set_index(today.index)
same = today.contract == yday.contract                # 两天必须是同一个合约
today, yday = today[same], yday[same]

up = today.hi > yday.hi                               # 严格高于，等于不算
down = today.lo < yday.lo
cls = pd.Series(np.select([up & down, up, down], ["两边都破", "只破上", "只破下"], "都没破"), index=today.index)

print("样本天数", len(cls))
print((cls.value_counts(normalize=True) * 100).round(1).to_string())
print("至少破一侧 %.1f%%，高点被破 %.1f%%，低点被破 %.1f%%" % (100 * (cls != "都没破").mean(), 100 * up.mean(), 100 * down.mean()))
