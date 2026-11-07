FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY services/alert-service/pom.xml ./
COPY services/alert-service/src ./src
# Remove the development password fallback only in this image build context.
RUN sed -i 's@^spring.datasource.password=.*@spring.datasource.password=${SPRING_DATASOURCE_PASSWORD}@' src/main/resources/application.properties
RUN mvn -B clean verify
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /src/target/alert-service-*.jar /app/app.jar
USER 10001:10001
EXPOSE 7301
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
