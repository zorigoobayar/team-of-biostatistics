df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
cor.test(df$bmi, df$chol)                       # Пирсон
cor.test(df$bmi, df$chol, method = "spearman", exact = FALSE)
