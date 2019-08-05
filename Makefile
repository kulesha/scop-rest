MAJOR    := $(shell jq -r '.version' package.json | cut -d . -f 1)
MINOR    := $(shell jq -r '.version' package.json | cut -d . -f 2)
SUB      := $(shell jq -r '.version' package.json | cut -d . -f 3)
PATCH    ?= 0
CODENAME ?= $(shell lsb_release -cs)
INSTALL   = apt-get install -y
SEDI = sed -i
ifeq ($(shell uname), Darwin)
        SEDI = sed -i ""
        INSTALL = echo
endif

.PHONY: test

clean:
	touch tmp
	rm -rf tmp *deb xunit.xml coverage node_modules build

package:
	pkg . -t node12-linux-x64

deb:    package
	touch tmp
	rm -rf tmp
	mkdir -p tmp/opt/scop/bin
	rsync -va --exclude .git deb-src/* tmp/
	cp tmp/DEBIAN/control.tmpl tmp/DEBIAN/control
	$(SEDI) "s/MAJOR/$(MAJOR)/g" tmp/DEBIAN/control
	$(SEDI) "s/MINOR/$(MINOR)/g" tmp/DEBIAN/control
	$(SEDI) "s/SUB/$(SUB)/g"     tmp/DEBIAN/control
	$(SEDI) "s/PATCH/$(PATCH)/g" tmp/DEBIAN/control
	$(SEDI) "s/CODENAME/$(CODENAME)/g" tmp/DEBIAN/control
	chmod -R 755 tmp/DEBIAN
	chmod -R go-w tmp
	rsync -va --exclude .git tmp/opt/scop/
	cp scop-rest-linux tmp/opt/scop/bin/ # pkg-packed all-in binary. copies over script in bin/. no prereqs!
	cp package.json tmp/opt/scop/bin/
	(cd tmp; fakeroot dpkg -b . ../scop-rest-api-$(MAJOR).$(MINOR).$(SUB)-$(PATCH)~$(CODENAME).deb)
