# 突破昨日高低点：今天日盘有没有突破昨天日盘的最高点 / 最低点
# 输入：清洗后的 ES 1 分钟 K 线（Databento ES.c.0，时间是 UTC，含 instrument_id 列）
import numpy as np
import pandas as pd
from pandas.tseries.holiday import (
    AbstractHolidayCalendar, Holiday, GoodFriday, USMartinLutherKingJr, USPresidentsDay,
    USMemorialDay, USLaborDay, USThanksgivingDay, nearest_workday, sunday_to_monday,
)


class NYSE(AbstractHolidayCalendar):  # 纽交所全天休市日
    rules = [
        Holiday("元旦", month=1, day=1, observance=sunday_to_monday),
        USMartinLutherKingJr, USPresidentsDay, GoodFriday, USMemorialDay,
        Holiday("六月节", month=6, day=19, start_date="2022-01-01", observance=nearest_workday),
        Holiday("独立日", month=7, day=4, observance=nearest_workday),
        USLaborDay, USThanksgivingDay,
        Holiday("圣诞节", month=12, day=25, observance=nearest_workday),
    ]


CLOSED = pd.to_datetime(["2012-10-29", "2012-10-30", "2018-12-05", "2025-01-09"])  # 临时休市

df = pd.read_csv("ES-1min_标准版.csv", usecols=["ts_event", "instrument_id", "high", "low"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
rth = df[(hm >= 930) & (hm < 1615)].assign(date=t.dt.normalize())  # 日盘 09:30–16:15
day = rth.groupby("date").agg(hi=("high", "max"), lo=("low", "min"), contract=("instrument_id", "first"))

# 昨天 = 上一个股市交易日（节假日后那天，用节前最后一个交易日）
cal = pd.bdate_range(day.index.min() - pd.Timedelta(days=10), day.index.max())
cal = cal[~cal.isin(NYSE().holidays(cal.min(), cal.max()).union(CLOSED))]
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
print("至少破一侧 %.1f%%" % (100 * (cls != "都没破").mean()))
