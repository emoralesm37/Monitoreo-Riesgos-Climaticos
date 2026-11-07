FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY gateway/ClimateGuard.Gateway/ gateway/ClimateGuard.Gateway/
# Readiness lives in the canonical source so every publish includes it.
RUN dotnet publish gateway/ClimateGuard.Gateway/ClimateGuard.Gateway.csproj -c Release -o /out /p:UseAppHost=false \
    && rm -f /out/appsettings*.json
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
COPY --from=build /out/ ./
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "ClimateGuard.Gateway.dll"]
