import * as discord from 'discord.js';
import { RichEmbed } from 'discord.js';
import * as path from 'path';
import { IBot, IBotCommand, IBotConfig, ILogger } from './api';
import { BotMessage } from './message';
import { websiteBotService } from './services/websiteBotService';
import { xpHandler } from './handlers/xpHandler';
import * as fs from 'fs';
import { MissingChannelIdError } from './errors';
import { messageService } from './services/messageService';
import { apiBotService } from './services/apiBotService';

export class Bot implements IBot {
    public get commands(): IBotCommand[] { return this._commands }

    public get logger() { return this._logger }

    public get allUsers() { return this._client ? this._client.users.array().filter((i) => i.id !== '1') : [] }

    public get onlineUsers() { return this.allUsers.filter((i) => i.presence.status !== 'offline') }

    private readonly _commands: IBotCommand[] = [];
    private _client!: discord.Client;
    private _config!: IBotConfig;
    private _logger!: ILogger;
    private _botId!: string;
    private _server!: discord.Guild;
    private _welcomeChannel!: discord.TextChannel;
    private _reportChannel!: discord.TextChannel;
    private _kicksAndBansChannel!: discord.TextChannel;
    private _faqChannel!: discord.TextChannel;
    private _websiteBotService!: websiteBotService;
    private _apiBotService!: apiBotService;
    private _messageService!: messageService;
    private _xpHandler!: xpHandler;

    public start(logger: ILogger, config: IBotConfig, commandsPath: string, dataPath: string) {
        this._logger = logger
        this._config = config
        this._server;
        this._welcomeChannel;
        this._reportChannel;
        this._kicksAndBansChannel;
        this._faqChannel;

        this.loadCommands(commandsPath, dataPath)

        if (!this._config.token) { throw new Error('invalid discord token') }

        this._client = new discord.Client()

        this._client.on('ready', () => {
            this._botId = this._client.user.id
            if (this._config.game) {
                this._client.user.setGame(this._config.game)
            }
            else {
                this._client.user.setActivity('?commands | With Dapper Dino', { type: 'PLAYING' });
            }
            if (this._config.username && this._client.user.username !== this._config.username) {
                this._client.user.setUsername(this._config.username)
            }
            this._client.user.setStatus('online')
            this._logger.info('started...')
            this._server = this._client.guilds.find((guild) => guild.id === this._config.serverId);
            this._welcomeChannel = this._server.channels.find(channel => channel.name === "welcome") as discord.TextChannel;
            this._faqChannel = this._server.channels.find(channel => channel.name === "f-a-q") as discord.TextChannel;
            this._reportChannel = this._server.channels.find(channel => channel.name === "reports") as discord.TextChannel;
            this._kicksAndBansChannel = this._server.channels.find(channel => channel.name === "kicks-and-bans") as discord.TextChannel;
            this._websiteBotService = new websiteBotService(this._client, this._config, this._server);
            this._websiteBotService.startupService();
            this._apiBotService = new apiBotService(this._client, this._config, this._server);
            this._apiBotService.startupService();
            this._messageService = new messageService(this._client, this._config);
            this._xpHandler = new xpHandler(this._config);
        })

        this._client.on('guildMemberAdd', async member => {
            let welcomeEmbed = new discord.RichEmbed()
                .setTitle("Welcome " + member.user.username + "!")
                .setColor("#ff0000")
                .addField("Information", "I've just sent you a PM with some details about the server, it would mean a lot if you were to give them a quick read.")
                .addField("Thanks For Joining The Other " + (member.guild.memberCount).toString() + " Of Us!", "Sincerely, your friend, DapperBot.")
            if (member.user.avatarURL != null) {
                welcomeEmbed.setImage(member.user.avatarURL);
            }
            else {
                welcomeEmbed.setImage(this._client.user.displayAvatarURL);
            }
            if (this._welcomeChannel != null)
                this._welcomeChannel.send(welcomeEmbed);
            else {
                let err = new MissingChannelIdError("welcome");
                err.log();
            }
            member.send("Hello " + member.displayName + ". Thanks for joining the server. If you wish to use our bot then simply use the command '?commands' in any channel and you'll recieve a pm with a list about all our commands. Anyway, here are the server rules:");
            let embed = new discord.RichEmbed()
                .addField("Rule 1", "Keep the chat topics relevant to the channel you're using")
                .addField("Rule 2", "No harassing others (we're all here to help and to learn)")
                .addField("Rule 3", "No spam advertising (if there's anything you're proud of and you want it to be seen then put it in the showcase channel, but only once)")
                .addField("Rule 4", "Don't go around sharing other people's work claiming it to be your own")
                .addField("Rule 5", "You must only use ?report command for rule breaking and negative behaviour. Abusing this command will result if you being the one who is banned")
                .addField("Rule 6", "Don't private message Dapper Dino for help, you're not more privileged than the other hundreds of people here. Simply ask once in the relevant help channel and wait patiently")
                .addField("Rule 7", "Read the documentation before asking something that it tells you right there in the documentation. That's why someone wrote it all!")
                .addField("Rule 8", "Understand that Dapper Dino and the other helping members still have lives of their own and aren't obliged to help you just because they are online")
                .addField("Rule 9", "Be polite, there's nothing ruder than people joining and demanding help")
                .addField("Rule 10", "Finally, we are here to teach, not to copy and paste code for you to use. If we see you have a problem that isn't too difficult to need help with then we will expect you to figure it out on your own so you actually learn whilst possibly giving you some hints if needed")
                .setThumbnail(this._client.user.displayAvatarURL)
                .setColor("0xff0000")
                .setFooter("If these rules are broken then don't be surprised by a ban")
            member.send(embed);
            member.send("If you are happy with these rules then feel free to use the server as much as you like. The more members the merrier :D");
            member.send("Use the command '?commands' to recieve a PM with all my commands and how to use them");
            member.send("(I am currently being tested on by my creators so if something goes wrong with me, don't panic, i'll be fixed. That's it from me. I'll see you around :)");
            member.addRole(member.guild.roles.find(role => role.name === "Member"));
        })

        this._client.on('guildMemberRemove', async member => {
            if (this._welcomeChannel != null)
                this._welcomeChannel.send(member.displayName + ", it's a shame you had to leave us. We'll miss you :(");
            else {
                let err = new MissingChannelIdError("welcome");
                err.log();
            }
        })

        this._client.on('message', async (message) => {
            if (message.author.id !== this._botId) {
                const text = message.cleanContent;
                this._logger.debug(`[${message.author.tag}] ${text}`);
                if (message.channel.type !== "dm") {
                    this._xpHandler.IncreaseXpOnMessage(message);
                    let ticketCategory = message.guild.channels.find(category => category.name === 'Tickets') as discord.CategoryChannel;
                    if ((message.channel as discord.TextChannel).parent == ticketCategory) {
                        this._messageService.HandleMessageInTicketCategory(message);
                    }
                    else {
                        for (const cmd of this._commands) {
                            try {
                                if (cmd.isValid(text)) {
                                    const answer = new BotMessage(message.author);
                                    await cmd.process(text, answer, message, this._client, this._config, this._commands, this._websiteBotService, this._server)
                                    if (this._config.idiotAnswer) {
                                        answer.setTextOnly(this._config.idiotAnswer)
                                    }
                                    if (answer.isValid()) {
                                        message.channel.send(answer.text || { embed: answer.richText })
                                            .then(console.log)
                                            .catch(console.error);
                                    }
                                    break
                                }
                            } catch (ex) {
                                this._logger.error(ex)
                                return
                            }
                        }
                    }
                    return;
                }
                for (const cmd of this._commands) {
                    try {
                        if (cmd.isValid(text)) {
                            const answer = new BotMessage(message.author);
                            await cmd.process(text, answer, message, this._client, this._config, this._commands, this._websiteBotService, this._server)
                            if (this._config.idiotAnswer) {
                                answer.setTextOnly(this._config.idiotAnswer)
                            }
                            if (answer.isValid()) {
                                message.channel.send(answer.text || { embed: answer.richText })
                                    .then(console.log)
                                    .catch(console.error);
                            }
                            break
                        }
                    } catch (ex) {
                        this._logger.error(ex)
                        return
                    }
                }
            }
        })

        this._client.login(this._config.token)
    }

    private loadCommands(commandsPath: string, dataPath: string) {
        if (!this._config.commands || !Array.isArray(this._config.commands) || this._config.commands.length === 0) {
            throw new Error('Invalid / empty commands list')
        }
        for (const cmdName of this._config.commands) {
            const cmdClass = require(`${commandsPath}/${cmdName}`).default
            const command = new cmdClass() as IBotCommand
            command.init(this, path.resolve(`${dataPath}/${cmdName}`))
            this._commands.push(command)
            this._logger.info(`command "${cmdName}" loaded...`)
        }
    }
}