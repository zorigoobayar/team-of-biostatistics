df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
table(Үнэлэгч1 = df$lvh_r1, Үнэлэгч2 = df$lvh_r2)
psych::cohen.kappa(cbind(df$lvh_r1, df$lvh_r2))
psych::ICC(df[, c("sbp8_home", "sbp8")])
d <- df$sbp8_home - df$sbp8
round(c(bias = mean(d), lower = mean(d) - 1.96 * sd(d), upper = mean(d) + 1.96 * sd(d)), 1)
