df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
df$group <- factor(df$group, levels = c("Плацебо", "Эм"))
aggregate(sbp8 ~ group, data = df, FUN = function(x) round(c(n = length(x), mean = mean(x), sd = sd(x)), 1))
t.test(sbp8 ~ group, data = df)
