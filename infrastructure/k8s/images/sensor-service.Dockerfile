FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/ backend/
COPY services/sensor-service/ services/sensor-service/
RUN dotnet publish services/sensor-service/ClimateGuard.Sensor.Api/ClimateGuard.Sensor.Api.csproj -c Release -o /out /p:UseAppHost=false \
    && rm -f /out/appsettings*.json
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
COPY --from=build /out/ ./
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "ClimateGuard.Sensor.Api.dll"]
