# Private build context contains only the explicitly captured runtime.tar.
# Never publish this validation image or expose it to an external network.
FROM scratch
ADD runtime.tar /
ENV LD_LIBRARY_PATH=/lib64:/usr/lib64/mysql
ENTRYPOINT ["/usr/bin/php", "-n", "-d", "extension_dir=/usr/lib64/php/modules", "-d", "extension=json.so", "-d", "extension=mysql.so", "-d", "extension=mbstring.so", "-d", "date.timezone=Asia/Taipei"]
