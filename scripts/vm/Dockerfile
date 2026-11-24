# The learner's Linux: Debian 12 (bookworm) i386, the last Debian release with an
# i386 kernel. v86 only runs 32-bit guests. Adapted from v86's tools/docker/debian
# (9p root filesystem), without X and systemd: PID 1 is le-init, a shell script.
#
# The full image (not -slim) keeps man pages, which 012.2 needs.
FROM i386/debian:bookworm@sha256:d7b4cda12aec9a2cca14c6720f4825664673e75caf70d6637d8553d166854703 AS base

# Downloads the i386 packages on the build machine's own (64-bit) platform: on
# GitHub's runners (kernel 7.0 azure) 32-bit programs can't resolve host names,
# so apt can't run in the i386 stage. apt plans for i386 against the base image's
# own package database, so it picks exactly what the i386 stage needs.
FROM --platform=$BUILDPLATFORM debian:bookworm@sha256:1d04200c2ece1d4d75a2a6f8e11ebce7d86a2ae28b34bb2c9cbb3ee9f4953e75 AS fetch
COPY --from=base /var/lib/dpkg/status /fetch/status
RUN mkdir -p /fetch/lists/partial /fetch/cache/archives/partial && \
    apt="apt-get -o APT::Architecture=i386 -o APT::Architectures::=i386 \
      -o Dir::State::status=/fetch/status -o Dir::State::Lists=/fetch/lists -o Dir::Cache=/fetch/cache" && \
    $apt update && \
    $apt install -y --no-install-recommends --download-only \
    linux-image-686 initramfs-tools kmod \
    locales less man-db manpages file procps psmisc \
    iproute2 iputils-ping bind9-host \
    nano vim-tiny sudo \
    tar gzip bzip2 xz-utils zip unzip

FROM base
ENV DEBIAN_FRONTEND=noninteractive

COPY --from=fetch /fetch/cache/archives/*.deb /tmp/debs/
RUN apt-get install -y --no-install-recommends /tmp/debs/*.deb && \
    rm -rf /tmp/debs /var/lib/apt/lists/*

RUN echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen && \
    locale-gen && \
    echo 'LANG="en_US.UTF-8"' > /etc/default/locale

# Mount the 9p root filesystem from the initramfs when the kernel command line says
# root=host9p (from v86's Debian example).
RUN printf '%s\n' 9p 9pnet 9pnet_virtio virtio virtio_ring virtio_pci >> /etc/initramfs-tools/modules && \
    printf '%s\n' \
    '#!/bin/sh' \
    'case $1 in prereqs) exit 0;; esac' \
    '. /scripts/functions' \
    'if [ "${ROOT}" = "host9p" ]; then' \
    '    mkdir -p ${rootmnt}' \
    '    mount -n -t 9p -o trans=virtio,version=9p2000.L,cache=loose,rw host9p ${rootmnt}' \
    'else' \
    '    . /scripts/local' \
    'fi' \
    > /etc/initramfs-tools/scripts/boot-9p && \
    chmod +x /etc/initramfs-tools/scripts/boot-9p && \
    echo 'BOOT=boot-9p' >> /etc/initramfs-tools/initramfs.conf && \
    # Only the modules listed above: the default (most) makes a 25 MB initrd that
    # can't be unpacked in the guest's 128 MB.
    sed -i 's/^MODULES=most/MODULES=list/' /etc/initramfs-tools/initramfs.conf && \
    update-initramfs -u

# TuxPixel Studio: the learner is mira. Passwords are public by design: the VM is
# offline and resets with every page load. Docker bind-mounts /etc/hosts and
# /etc/hostname during the build, so le-init writes those at boot.
RUN useradd -m -s /bin/bash -c 'Mira Okafor' mira && \
    useradd -m -s /bin/bash -c 'Jonas Berg' jonas && \
    useradd -m -s /bin/bash -c 'Ada Lindqvist' ada && \
    echo 'mira:tuxpixel' | chpasswd && \
    echo 'jonas:tuxpixel' | chpasswd && \
    echo 'ada:tuxpixel' | chpasswd && \
    usermod -aG sudo mira

COPY le-init /sbin/le-init
RUN chmod 755 /sbin/le-init
