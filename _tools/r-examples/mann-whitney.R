df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
df$group <- factor(df$group, levels = c("Плацебо", "Эм"))
tapply(df$pain6, df$group, summary)
wilcox.test(pain6 ~ group, data = df, conf.int = TRUE, exact = FALSE)
