# Debian 13 (trixie) with systemd as PID 1, for capturing the transcripts the
# simulators replay (PLAN.md §6a). One image serves every TuxPixel host; the
# capture script starts them on a network in the documentation ranges.
FROM debian:trixie@sha256:3cda3ca472ce45507a5109c6a3907093e24d9ae67d55954c9a07a45665dafba2
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      systemd systemd-sysv systemd-resolved dbus libpam-systemd \
      nginx openssh-server openssh-client \
      iproute2 iputils-ping bind9-host dnsmasq-base \
      expect locales sudo procps less passwd wtmpdb libpam-wtmpdb ca-certificates \
      rsyslog net-tools \
    && rm -rf /var/lib/apt/lists/*
RUN sed -i 's/^# en_US.UTF-8/en_US.UTF-8/' /etc/locale.gen && locale-gen && update-locale LANG=en_US.UTF-8
# The studio's people, as in the browser guest. Every password is tuxpixel.
RUN for u in mira jonas ada; do useradd -m -s /bin/bash "$u"; echo "$u:tuxpixel" | chpasswd; done && usermod -aG sudo mira
# Every step runs in a new terminal; with a global timestamp sudo asks for the
# password once, as it does within one terminal session. sudo keeps
# the pager settings, so commands under sudo don't open a pager either.
RUN printf 'Defaults timestamp_type=global\nDefaults env_keep += "SYSTEMD_PAGER DPKG_PAGER"\n' > /etc/sudoers.d/capture && chmod 440 /etc/sudoers.d/capture
# nginx starts one worker per CPU by default, which floods ss and netstat on a
# many-core host; two keep the listings readable.
RUN sed -i 's/^worker_processes auto;/worker_processes 2;/' /etc/nginx/nginx.conf && grep -q '^worker_processes 2;' /etc/nginx/nginx.conf
# Units a container can't run.
RUN systemctl mask systemd-modules-load.service systemd-firstboot.service systemd-udevd.service systemd-udevd-kernel.socket systemd-udevd-control.socket getty@tty1.service
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
