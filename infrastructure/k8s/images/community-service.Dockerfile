FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY services/community-service/ ./
RUN dotnet publish ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj -c Release -o /out /p:UseAppHost=false && rm -f /out/appsettings*.json
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
COPY --from=build /out/ ./
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "ClimateGuard.Community.Api.dll"]
