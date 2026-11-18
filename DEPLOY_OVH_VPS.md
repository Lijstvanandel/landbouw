# Volledige OVH VPS Installatiehandleiding (Poort 3130 + Nginx + Let's Encrypt)

Stapsgewijze handleiding voor Ubuntu/Debian op een OVH VPS waarop al andere applicaties draaien.

---

## 1. Map aanmaken en repository clonen / pullen

```bash
# Maak de doelmap aan (of kies /opt/apps/...)
sudo mkdir -p /var/www/steenwijkerland-conversies
sudo chown -R $USER:$USER /var/www/steenwijkerland-conversies

# Stap in de map en clone (eerste keer):
cd /var/www/steenwijkerland-conversies
git clone <JOUW_GIT_REPO_URL> .

# OF als je later een update ophaalt:
# git pull origin main
```

---

## 2. Node.js 22 LTS & PM2 controleren / installeren

Als Node.js 20/22 en PM2 al voor andere apps op je VPS staan, kun je stap 2 overslaan. Controleer eerst met `node -v` en `pm2 -v`.

```bash
# Node.js 22 LTS installeren (indien nog niet aanwezig of ouder dan v20)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# PM2 globaal installeren (indien nog niet aanwezig)
sudo npm install -g pm2
```

---

## 3. Dependencies installeren, `.env` instellen en bouwen

```bash
cd /var/www/steenwijkerland-conversies

# Installeer alle benodigde Node packages
npm install

# Maak .env aan en zet poort 3130 + productiemodus
cp .env.example .env
nano .env
```

Zorg dat minimaal dit in `.env` staat:
```env
PORT=3130
NODE_ENV=production
APP_URL="https://jouw-subdomein.nl"
```

Bouw vervolgens de frontend (`dist/`):
```bash
npm run build
```

---

## 4. Applicatie starten met PM2 op poort 3130

```bash
# Start de app via ecosystem.config.cjs op poort 3130
pm2 start ecosystem.config.cjs --env production

# Sla het PM2-proces op zodat het automatisch start na een VPS-reboot
pm2 save
pm2 startup
# (Voer het commando uit dat `pm2 startup` eventueel toont)
```

Controleer lokaal of poort 3130 reageert:
```bash
curl http://127.0.0.1:3130/api/health
```
Verwachte output:
`{"status":"ok","port":3130,"environment":"production","conversiesCount":132,"gebouwenCount":251,...}`

---

## 5. DNS + Nginx Reverse Proxy instellen

Zorg eerst bij je DNS-provider (of OVH DNS) dat een **A-record** (bijv. `conversies.jouwdomein.nl`) verwijst naar het publieke IP-adres van je OVH VPS.

Installeer Nginx en Certbot indien nog niet aanwezig:
```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Maak de Nginx virtual host aan:
```bash
sudo cp /var/www/steenwijkerland-conversies/deploy/nginx-steenwijkerland.conf.example /etc/nginx/sites-available/steenwijkerland.conf
sudo nano /etc/nginx/sites-available/steenwijkerland.conf
```

Vervang `conversies.jouwdomein.nl` in het bestand door jouw echte domein/subdomein:
```nginx
server {
    listen 80;
    server_name jouw-subdomein.nl;

    location / {
        proxy_pass http://127.0.0.1:3130;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

Activeer de site en herlaad Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/steenwijkerland.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Firewall (UFW) controleren

Zorg dat poort 80 en 443 openstaan (poort `3130` blijft veilig op `127.0.0.1` en hoeft **niet** publiek open):
```bash
sudo ufw allow 'Nginx Full'
sudo ufw status
```

---

## 7. SSL-certificaat met Let's Encrypt (Certbot)

```bash
sudo certbot --nginx -d jouw-subdomein.nl
```
Volg de vragen (e-mailadres + akkoord + optioneel redirect naar HTTPS kiezen). Certbot past automatisch je Nginx-config aan met HTTPS (poort 443) en automatische verlenging.

Test automatische verlenging:
```bash
sudo certbot renew --dry-run
```

---

## 8. Updaten na nieuwe wijzigingen (`git pull`)

```bash
cd /var/www/steenwijkerland-conversies
git pull origin main
npm install
npm run build
pm2 restart agrarische-conversies-steenwijkerland
```
