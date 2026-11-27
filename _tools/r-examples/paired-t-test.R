df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
d <- df$sbp8 - df$sbp0
summary(d)
t.test(df$sbp8, df$sbp0, paired = TRUE)
