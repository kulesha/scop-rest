# SCOP REST API 

## Installation

### install node
$ sudo apt-get install curl
$ curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
$ sudo apt-get install nodejs

### install express
$ npm install express

### clone the code
$ git clone https://github.com/kulesha/scop-rest.git


## Running
### development server
$ cd scop-rest
$ node server --config ./config.json

### production server
#### build an executable
$ cd scop-rest
$ sudo npm install -g pkg
$ pkg . -t node12-linux-x64
#### configure db connection
$ vi config.json
$ sudo mkdir /opt/scop
$ sudo cp config.json /opt/scop
$ sudo ./scop-rest
