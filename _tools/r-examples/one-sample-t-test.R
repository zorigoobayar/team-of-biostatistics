df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
mean(df$bmi); sd(df$bmi)
t.test(df$bmi, mu = 25)
