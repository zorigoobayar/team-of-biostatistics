df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
library(survival)
df$group <- factor(df$group, levels = c("Плацебо", "Эм"))
km <- survfit(Surv(time_months, event) ~ group, data = df)
km
summary(km, times = c(12, 24))
survdiff(Surv(time_months, event) ~ group, data = df)
