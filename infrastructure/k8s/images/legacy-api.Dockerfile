FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/ backend/
COPY infrastructure/k8s/images/LegacyHosting.cs backend/ClimateGuard.Api/LegacyHosting.cs
# TLS terminates at Ingress. Defaults remain unchanged outside this image/config.
RUN grep -Fq 'if (!app.Environment.IsDevelopment())' backend/ClimateGuard.Api/Program.cs && \
    sed -i 's@if (!app.Environment.IsDevelopment())@if (!app.Environment.IsDevelopment() \&\& builder.Configuration.GetValue("Hosting:HttpsRedirectionEnabled", true))@;s@app.MapHealthChecks("/health");@app.MapHealthChecks("/health");\nLegacyHosting.MapClusterReadiness(app);@' backend/ClimateGuard.Api/Program.cs
RUN dotnet publish backend/ClimateGuard.Api/ClimateGuard.Api.csproj -c Release -o /out /p:UseAppHost=false \
    && rm -f /out/appsettings*.json
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
COPY --from=build /out/ ./
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "ClimateGuard.Api.dll"]
