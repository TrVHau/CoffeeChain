# ── Stage 1: Build ──────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
# Download dependencies first (cached layer)
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn package -DskipTests -q

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Non-root user for security
RUN addgroup --system coffeechain && adduser --system --ingroup coffeechain coffeechain
USER coffeechain

COPY --from=build /app/target/coffee-trace-backend-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
