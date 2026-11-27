df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
summary(df$pain6 - df$pain0)
wilcox.test(df$pain6, df$pain0, paired = TRUE, conf.int = TRUE, exact = FALSE)
