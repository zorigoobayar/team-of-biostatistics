df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
df$smoker <- factor(df$smoker, levels = c("Үгүй", "Тийм"))
m_p <- glm(ari ~ city + smoker + offset(log(years)), family = poisson, data = df)
sum(residuals(m_p, type = "pearson")^2) / df.residual(m_p)   # хэт тархалтын харьцаа
m_nb <- MASS::glm.nb(ari ~ city + smoker + offset(log(years)), data = df)
summary(m_nb)
round(exp(cbind(IRR = coef(m_nb), confint.default(m_nb))), 2)
