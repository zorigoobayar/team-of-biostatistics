df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
library(pROC)
r <- roc(infection ~ pct, data = df, levels = c("Үгүй", "Тийм"), direction = "<", ci = TRUE)
r
coords(r, "best", best.method = "youden",
       ret = c("threshold", "sensitivity", "specificity", "ppv", "npv"))
tab <- table(Test = factor(df$pct >= 0.5, levels = c(TRUE, FALSE)),
             Infection = factor(df$infection, levels = c("Тийм", "Үгүй")))
tab
epiR::epi.tests(tab, conf.level = 0.95)
