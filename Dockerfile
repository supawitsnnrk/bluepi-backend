FROM node:lts
WORKDIR /usr/src/app
COPY . .
RUN yarn
RUN yarn build

EXPOSE 9000
CMD ["yarn", "start"]