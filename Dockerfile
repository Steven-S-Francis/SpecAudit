FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY backend/backend.csproj ./backend/
RUN dotnet restore ./backend/backend.csproj
COPY backend/ ./backend/
RUN dotnet publish ./backend/backend.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /app/dist ./wwwroot
EXPOSE 5000
ENTRYPOINT ["dotnet", "backend.dll"]
