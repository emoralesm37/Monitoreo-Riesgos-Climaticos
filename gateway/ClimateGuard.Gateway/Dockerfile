FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY gateway/ClimateGuard.Gateway/ClimateGuard.Gateway.csproj gateway/ClimateGuard.Gateway/
RUN dotnet restore gateway/ClimateGuard.Gateway/ClimateGuard.Gateway.csproj

COPY gateway/ClimateGuard.Gateway/ gateway/ClimateGuard.Gateway/

RUN dotnet publish gateway/ClimateGuard.Gateway/ClimateGuard.Gateway.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

COPY --from=build /app/publish .

USER $APP_UID

ENTRYPOINT ["dotnet", "ClimateGuard.Gateway.dll"]