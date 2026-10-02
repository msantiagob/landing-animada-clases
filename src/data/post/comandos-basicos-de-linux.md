---
publishDate: 2026-10-01T00:00:00Z
title: 'Comandos básicos de Linux: guía práctica por tareas, con ejemplos'
excerpt: 'Los comandos básicos de Linux por tarea: archivos, permisos, apt, servicios, red, SSH y compresión, con ejemplos, advertencias y una rutina de práctica.'
image: ~/assets/images/seo/blog-comandos-basicos-de-linux.jpg
category: Infraestructura
tags:
  - linux
  - terminal
  - comandos
  - bash
  - servidores
author: Santiago Bedoya
metadata:
  title: 'Guía de comandos básicos de Linux con ejemplos'
  ignoreTitleTemplate: true
  description: 'Aprende los comandos básicos de Linux por tarea: archivos, permisos, sudo, apt, procesos, systemctl, red, SSH y compresión, con ejemplos y advertencias.'
---

**Los comandos básicos de Linux son el conjunto de instrucciones que necesitas para moverte por el sistema de archivos, manejar archivos y permisos, instalar software, vigilar procesos y servicios, revisar disco y red, y conectarte a otros equipos por SSH.** Con unas pocas decenas dominas el trabajo diario de administrar un servidor. Esta guía los organiza por tarea, pensada para Ubuntu y Debian (los más usados en servidores y VPS), con ejemplos reales y las advertencias que evitan desastres.

Tres reglas antes de empezar: casi todo comando acepta `--help` (`ls --help`) y tiene manual (`man ls`); la tecla `Tab` completa nombres y evita errores de tipeo; y `Ctrl + C` detiene lo que esté corriendo. Un comando suele tener la forma `comando -opciones argumentos`: las opciones cortas se pueden combinar (`ls -lah` equivale a `ls -l -a -h`) y las rutas con espacios van entre comillas.

## Referencia rápida de comandos básicos de Linux

| Tarea             | Comando                      | Qué hace                                               |
| ----------------- | ---------------------------- | ------------------------------------------------------ |
| Saber dónde estás | `pwd`                        | Muestra la ruta actual                                 |
| Listar            | `ls -lah`                    | Lista con detalle, archivos ocultos y tamaños legibles |
| Moverte           | `cd /var/log`                | Entra a esa ruta (`cd -` vuelve a la anterior)         |
| Crear carpetas    | `mkdir -p a/b/c`             | Crea la ruta completa                                  |
| Copiar y mover    | `cp -r`, `mv`                | Copia (con carpetas) o mueve y renombra                |
| Borrar            | `rm`, `rm -r`                | Elimina sin papelera                                   |
| Leer              | `less`, `tail -f`            | Navega un archivo o sigue un log en vivo               |
| Buscar texto      | `grep -rn "error" .`         | Busca en archivos, con número de línea                 |
| Buscar archivos   | `find . -name "*.log"`       | Localiza por nombre, tamaño o fecha                    |
| Permisos          | `chmod`, `chown`             | Cambia permisos o dueño                                |
| Administrador     | `sudo`                       | Ejecuta un comando con privilegios                     |
| Paquetes          | `apt update`, `apt install`  | Actualiza el índice e instala software                 |
| Procesos          | `ps aux`, `top`, `kill`      | Lista, monitorea y detiene                             |
| Servicios         | `systemctl`, `journalctl`    | Controla servicios y lee sus logs                      |
| Disco y memoria   | `df -h`, `du -sh`, `free -h` | Espacio libre y uso de RAM                             |
| Red               | `ip a`, `ss -tulpn`, `curl`  | Direcciones, puertos y peticiones HTTP                 |
| Acceso remoto     | `ssh`, `scp`, `rsync`        | Conexión remota y copia de archivos                    |
| Comprimir         | `tar -czvf`, `unzip`         | Empaqueta y descomprime                                |

## Navegación y archivos

```bash
pwd                           # /home/santiago
ls -lah                       # detalle, ocultos y tamaños legibles
cd /var/log                   # ruta absoluta

mkdir -p proyectos/app/logs   # crea toda la ruta
cp -r proyectos copia         # copia una carpeta
mv notas.txt notas-2026.txt   # mover y renombrar es lo mismo
```

Una ruta que empieza con `/` es absoluta (parte de la raíz); si no, es relativa a donde estás. Entender esa diferencia evita muchos errores de principiante.

## Ver y buscar contenido

```bash
less /var/log/dpkg.log                 # navega con flechas; q sale
tail -f /var/log/nginx/error.log       # sigue un log en vivo
grep -rn "timeout" /etc/nginx          # busca texto, con número de línea
grep -i "error" app.log | wc -l        # cuenta líneas con "error"
find /var/log -name "*.log" -mtime -1  # logs del último día
find . -type f -size +100M             # archivos de más de 100 MB
```

El _pipe_ `|` conecta la salida de un comando con la entrada del siguiente: es la idea más poderosa de la terminal. Cuando domines estos, prueba alternativas modernas como `rg` (ripgrep), `fd` y `bat`.

## Permisos, usuarios y sudo

Cada archivo tiene permisos de lectura (`r`), escritura (`w`) y ejecución (`x`) para tres grupos: el dueño, el grupo y los demás. En `ls -l` los ves así: `-rwxr-xr--`. En notación numérica, `r=4`, `w=2` y `x=1`: `755` significa dueño `rwx`, grupo y otros `r-x`.

```bash
chmod +x despliegue.sh           # lo vuelve ejecutable
chmod 644 index.html             # dueño lee y escribe; los demás leen
chmod 600 ~/.ssh/id_ed25519      # una llave privada: solo su dueño
sudo chown -R www-data:www-data /var/www/sitio

sudo adduser deploy              # crea un usuario
sudo usermod -aG sudo deploy     # lo hace administrador (Ubuntu y Debian)
```

`sudo` ejecuta un solo comando con privilegios de administrador y deja registro de quién lo hizo. Trabajar siempre como `root` es mala práctica: un error de tipeo con privilegios totales no tiene red de seguridad.

## Paquetes con apt

```bash
sudo apt update          # refresca el índice
sudo apt upgrade         # actualiza lo instalado
apt search nginx         # busca paquetes
sudo apt install nginx   # instala
sudo apt remove nginx    # desinstala (conserva la configuración)
sudo apt autoremove      # limpia dependencias huérfanas
```

`apt` es el gestor de Debian y Ubuntu; en Fedora, AlmaLinux o Rocky el equivalente es `dnf`. Un hábito sano en servidores: haz un respaldo o un _snapshot_ antes de un `upgrade` grande.

## Procesos, servicios y logs

```bash
ps aux | grep nginx                    # ¿está corriendo?
top                                    # CPU y RAM en vivo (q sale)
kill 4321                              # pide terminar (SIGTERM)
kill -9 4321                           # lo mata a la fuerza: último recurso

systemctl status nginx                 # estado del servicio
sudo systemctl restart nginx           # reinicia
sudo systemctl enable --now nginx      # arranca ahora y en cada reinicio
journalctl -u nginx -n 50 --no-pager   # últimas 50 líneas de sus logs
journalctl -u nginx -f                 # sigue sus logs en vivo
journalctl -p err -b                   # errores desde el último arranque
```

Cuando un servicio falla, el orden es siempre el mismo: `systemctl status` para ver el estado, `journalctl -u servicio` para leer por qué falló, y solo entonces tocar la configuración.

## Disco, memoria y red

```bash
df -h                                  # espacio libre por partición
du -h --max-depth=1 /var | sort -h     # qué carpetas ocupan más
free -h                                # RAM y swap

ip a                                   # direcciones IP
ping -c 4 8.8.8.8                      # ¿hay salida a internet?
curl -I https://sonmyd.co              # solo las cabeceras HTTP
sudo ss -tulpn                         # puertos en escucha y su proceso
```

Un disco lleno es una causa frecuente de servicios caídos «sin explicación»: revisa `df -h` temprano.

## SSH, copia de archivos y compresión

```bash
ssh-keygen -t ed25519 -C "tu@correo.com"
ssh-copy-id deploy@203.0.113.10                   # instala la llave en el servidor
ssh deploy@203.0.113.10                           # entra sin contraseña

scp ./informe.pdf deploy@203.0.113.10:/home/deploy/
rsync -avz ./dist/ deploy@203.0.113.10:~/sitio/

tar -czvf respaldo.tar.gz proyectos/              # empaqueta y comprime
tar -tzf respaldo.tar.gz                          # lista sin extraer
tar -xzvf respaldo.tar.gz -C /tmp                 # extrae en /tmp
```

La IP `203.0.113.10` está reservada para ejemplos: reemplázala por la de tu servidor. Cuando administres varios, un archivo `~/.ssh/config` con alias (`Host`, `HostName`, `User`, `IdentityFile`) te ahorra escribir la IP y la llave cada vez.

Para endurecer un servidor, desactiva el acceso por contraseña y el inicio de sesión de root en `/etc/ssh/sshd_config` (`PasswordAuthentication no` y `PermitRootLogin no`), valida con `sudo sshd -t` y recarga con `sudo systemctl reload ssh` (en Debian y Ubuntu el servicio se llama `ssh`). **Antes de cerrar tu sesión, abre otra y comprueba que puedes entrar**: si te equivocas, te quedas fuera de tu propio servidor.

## Cinco comandos peligrosos y cómo usarlos con cuidado

1. **`rm -rf`** borra sin papelera ni confirmación. Un `rm -rf "$CARPETA"/*` con la variable vacía se convierte en `rm -rf /*`. Revisa primero con `ls` el mismo patrón, verifica la ruta con `pwd` y usa `rm -i` si dudas.
2. **`chmod -R 777`** da permiso de escritura a todo el mundo. Parece arreglar un error, pero abre un hueco de seguridad. Corrige dueño y grupo con `chown` y da solo los permisos necesarios.
3. **`sudo echo "x" > /etc/archivo`** falla, porque la redirección la ejecuta tu usuario y no `sudo`. Usa `echo "x" | sudo tee /etc/archivo`.
4. **`curl ... | sudo bash`** ejecuta con privilegios algo que no leíste. Descarga el script, léelo y luego ejecútalo.
5. **`ufw enable` sin permitir SSH** te deja fuera. Primero `sudo ufw allow OpenSSH` y después `sudo ufw enable`.

## Rutina de práctica de 30 minutos

Practicar en producción es la peor idea: usa una máquina desechable. Puede ser Ubuntu con Multipass (`multipass launch 24.04 --name lab`), WSL en Windows (`wsl --install -d Ubuntu`) o un VPS pequeño; si dudas de cuándo conviene este último, lee [qué es un VPS y cuándo lo necesitas](/blog/que-es-un-vps-y-cuando-lo-necesitas). Escribe cada comando a mano y predice el resultado antes de pulsar Enter:

```bash
mkdir -p ~/lab/docs && cd ~/lab
echo "hola linux" > docs/nota.txt
sudo apt update && sudo apt install -y nginx
systemctl status nginx --no-pager
sudo ss -tulpn | grep :80
journalctl -u nginx -n 20 --no-pager
tar -czvf lab.tar.gz docs && tar -tzf lab.tar.gz
sudo apt remove -y nginx
```

Repítela durante una semana quitando una ayuda cada día: primero con esta guía, luego sin ella. El último día rompe algo a propósito (un permiso, un servicio detenido) y arréglalo leyendo los logs.

Si prefieres aprender con acompañamiento, el [curso de Linux](/curso-de-linux) cubre terminal, Bash, SSH, Nginx, Docker y administración de servidores con práctica guiada. Y si ya tienes un servidor en producción y no quieres administrarlo solo, mira nuestro servicio de [administración de servidores Linux y VPS](/servidores-y-vps).

## Preguntas frecuentes

### ¿Qué distribución de Linux conviene para aprender?

Ubuntu LTS o Debian: tienen documentación abundante, son de las más usadas en servidores y VPS, y todo lo de esta guía aplica sin cambios.

### ¿Cuál es la diferencia entre sudo y root?

`root` es el superusuario, con control total. `sudo` te presta esos privilegios para un solo comando y deja registro, lo que es más seguro que trabajar como `root` todo el tiempo.

### ¿Cómo salgo de nano o de vim?

En nano, `Ctrl + X` (y confirma si quieres guardar). En vim, pulsa `Esc` y escribe `:q!` para salir sin guardar o `:wq` para guardar y salir.

### ¿Estos comandos sirven en macOS?

Gran parte sí, porque macOS también es Unix, pero su terminal usa utilidades BSD: algunas opciones cambian y no existen `apt` ni `systemctl`.

## Conclusión

No necesitas memorizar cientos de comandos: con navegación, archivos, permisos, `apt`, `systemctl`, `journalctl`, red, SSH y `tar` resuelves la mayoría del trabajo diario. Lo que cambia tu nivel es practicar en un entorno seguro y leer los logs antes de tocar nada. Repite la rutina hasta que no necesites mirar la guía.

---

_¿Quieres aprenderlo con un profesor? Mira el [curso de Linux](/curso-de-linux) o, si prefieres delegar la administración de tus servidores, conoce el servicio de [servidores y VPS](/servidores-y-vps). También puedes escribirnos por [WhatsApp](https://wa.me/573106041144)._
