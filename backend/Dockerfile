ARG APP_VERSION=0.0.0

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY duedgusto.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish duedgusto.csproj -c Release -o /app/publish --no-restore

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
LABEL version=$APP_VERSION
WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
# UID e GID FISSI, non assegnati dal sistema: "useradd -r" prende il primo identificativo
# libero scendendo da 999, quindi può cambiare al variare dell'immagine base. Sul bind mount
# dei media l'UID è l'unica cosa che il kernel confronta — un chown sull'UID sbagliato produce
# un container che non riesce a scrivere, e il guasto si vede solo in produzione perché in
# sviluppo il container non c'è. Lo stesso 10001 compare in deploy/scripts/*.sh.
RUN groupadd -r -g 10001 appuser && useradd -r -u 10001 -g appuser appuser

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 5000

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "duedgusto.dll"]
