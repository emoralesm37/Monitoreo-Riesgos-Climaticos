FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj \
    ClimateGuard.Community.Domain/
COPY ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj \
    ClimateGuard.Community.Application/
COPY ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj \
    ClimateGuard.Community.Infrastructure/
COPY ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj \
    ClimateGuard.Community.Api/

RUN dotnet restore \
    ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj

COPY . .

RUN dotnet publish \
    ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj \
    --configuration Release \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

USER $APP_UID

ENTRYPOINT ["dotnet", "ClimateGuard.Community.Api.dll"]