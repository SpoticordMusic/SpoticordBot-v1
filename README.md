<a href="https://spoticord.com/" style="background-color: #383838; margin: 20px;">
  <img src="https://spoticord.com/img/spoticord-with-text.png?nocache=2" alt="Spoticord logo" title="Spoticord" align="right" height="80" />
</a>

# Spoticord Music

<sub><sup>First of all I want to tell everyone that I am terrible at making README's so if you see something horrible please let me know 🙃</sup></sub>

## Table of contents

* [Introduction](#introduction)
  * ["Do I need to setup my own bot to use this?"](#do-i-need-to-setup-my-own-bot-to-use-this)
  * [Difference between the open source version and the live version](#difference-between-the-open-source-version-and-the-live-version)
  * [Why open source?](#why-open-source)
* [Setting Up](#setting-up)
  * [The config.json file](#the-configjson-file)
  * [Setting up Lavalink](#setting-up-lavalink)
  * [Setting up a Discord application](#setting-up-a-discord-application)
  * [Setting up a Spotify application](#setting-up-a-spotify-application)
  * [Setting up your Spotify OAuth](#setting-up-your-spotify-oauth)
  * [Building the source](#building-the-source-code)
  * ["I still haven't got a clue"](#i-still-havent-got-a-clue)

# Introduction

Spoticord is a music bot designed to work using your Spotify player, instead of all those annoying commands like `play`, `skip` and `pause` to control a music bot.

Just join a voice channel with the bot, go to your Spotify player on either your PC or your phone, and just switch to Spoticord. The bot will now play every song that you play on Spotify, while also responding to pause, resume, and seeking through a song.

Users who join the Spotify party after you have started one will have their Spotify mimic what yours is doing, so that these users can see what kind of tunes you are playing.

## "Do I need to setup my own bot to use this?"
<b>No</b>, Spoticord already has an official bot and can be invited via the [Spoticord website](https://spoticord.com/). This version of Spoticord also contains extra features (like an analytics dashboard) and will receive additional features in the future (like live lyrics perhaps 👀). You will only have to follow the setup if you want to run Spoticord as your own bot, just remember that running Spoticord on your own can come with some complications.

## Difference between the open source version and the live version
Fundamentally, there is no difference. Both the open source and live version use your Spotify player as the control panel for playing music. However the live version may have limited functionality on some quality of life features, like renaming the Spoticord device in Spotify. This is one of the features that is free when you are using the selfhosted version. Setting up your own version of Spoticord is also a lot more difficult than just inviting the live version to your server(s).

## Why open source?
I believe that in this world we all should have at least the privilege of seeing how a program is made. As a security enthousiast I find that this can significantly help in finding and fixing (yet to be known) vulnerabilitites and also gives people a chance to contribute and make projects even better than they were before.

<br/>
<b>But enough rambling, time to get set up</b>

# Setting up
Get started by cloning this project and installing the required dependencies.
```
$ git clone https://github.com/SpoticordMusic/Spoticord.git
$ cd Spoticord
$ npm install
```

Also make sure that you have typescript tools installed, you can check this by running `tsc -v`. If this does not work you will have to install typescript using `npm i -g typescript`.

Now before you can properly use the bot you will have to setup a few things.

## The config.json file
You can find an example `config.example.json` file at the root of the repo. This json file contains an empty line somewhere in the middle. Every entry **above** this line is **required**. All the lines below this empty line are **optional** and should be omitted if you won't need to tamper with these settings.

| Key                   | Required | Default                  | Description |
| --------------------- |:--------:|:------------------------:| ----------- |
| prefix                | **Yes**  | N/A                      | The command prefix (e.g. '+', '!')
| token                 | **Yes**  | N/A                      | The Discord bot token
| spotify_client_id     | **Yes**  | N/A                      | The Spotify client ID
| spotify_client_secret | **Yes**  | N/A                      | The Spotify client secret
| nodes                 | **Yes**  | N/A                      | An array of objects containing lavalink Nodes (id: string, host: string, port: number, password: string
| linker_hostname       | No       | '127.0.0.1'              | The hostname the linker website will listen on
| linker_port           | No       | 4481                     | The port number the linker website will listen on
| spotify_redirect_url  | No       | 'http://localhost:4481/' | The redirect url for the Spotify OAuth procedure


## Setting up Lavalink
You can download Lavalink from [the official releases page](https://github.com/freyacodes/Lavalink/releases/). Make sure to download the most up-to-date version to get better speed and stability.

After downloading the jar file you will need to create a new file called `application.yml` with your preferred Lavalink configuration. A template version can be found [here](https://github.com/freyacodes/Lavalink/blob/master/LavalinkServer/application.yml.example). If you need more information about Lavalink you can visit the [Lavalink repo](https://github.com/freyacodes/Lavalink).

For changing the `application.yml` the only two fields that are the most important are the `port` and `password` field. These values need to be changed accordingly inside the `nodes` field in the `config.json` file

## Setting up a Discord application
Create a new Discord application and bot in your [Discord Developer Dashboard](https://discord.com/developers). If you need help setting up your application then Google is your best friend.

Once you have your bot ready copy your discord bot token to the `config.json` file in the `token` field.

## Setting up a Spotify application
Create a new Spotify application in your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/). If you need help setting up your application then (what a surprise) Google is your best friend.

Once you have your application ready you can copy your client ID and client secret (click `SHOW CLIENT SECRET`) and place them both respectively in the `config.json` file under `spotify_client_id` and `spotify_client_secret`

## Setting up your Spotify OAuth
If only you are planning to use your bot then you can simple add `http://localhost:4481/` to your Spotify application as a redirect URL. Don't forget to remove the `spotify_redirect_url` from the `config.json` if you do this. If you are however planning on other people using this bot too, then you need to make sure the bot can be reached using either port forwarding or hosting the bot on a VPS. Set the `linker_hostname` to '0.0.0.0' in the `config.json` and set the `linker_port` to a port of your choosing. Then add your preferred redirect url to your Spotify application and to the `spotify_redirect_url` field in the `config.json` file.

## Building the source code
When this is all finally done you can build the source by running `npm run build` and then start the bot with `npm run start`. These commands can also be combined by using the `npm run compile` command.

## "I still haven't got a clue"
If you get stuck or simply don't know how to continue with one of the steps then feel free to join the [Spoticord Support Server](https://discord.gg/wRCyhVqBZ5) and ask away inside the [#questions](https://discord.com/channels/779292533053456404/782587728126279692) channel.

# Docker
soon?
