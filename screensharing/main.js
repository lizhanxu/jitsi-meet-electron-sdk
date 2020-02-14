const { app, BrowserWindow, ipcMain, screen } = require('electron');

const { SCREEN_SHARE_EVENTS_CHANNEL, SCREEN_SHARE_EVENTS, TRACKER_SIZE } = require('./constants');

/**
 * Main process component that sets up electron specific screen sharing functionality, like screen sharing
 * tracker and window selection.
 * The class will process events from {@link ScreenShareRenderHook} initialized in the renderer, and the
 * always on top screen sharing tracker window.
 */
class ScreenShareMainHook {
    /**
     * Create ScreenShareMainHook linked to jitsiMeetWindow.
     *
     * @param {BrowserWindow} jitsiMeetWindow - BrowserWindow where jitsi-meet api is loaded.
     * @param {string} identity - Name of the application doing screen sharing, will be displayed in the
     * screen sharing tracker window text i.e. {identity} is sharing your screen.
     */
    constructor(jitsiMeetWindow, identity) {
        this._jitsiMeetWindow = jitsiMeetWindow;
        this._identity = identity;
        this._onScreenSharingEvent = this._onScreenSharingEvent.bind(this);

        // Listen for events coming in from the main render window and the screen share tracker window.
        ipcMain.on(SCREEN_SHARE_EVENTS_CHANNEL, this._onScreenSharingEvent);

        // Clean up ipcMain handlers to avoid leaks.
        app.once('window-all-closed', () => {
            ipcMain.removeListener(SCREEN_SHARE_EVENTS_CHANNEL, this._onScreenSharingEvent);
        });
    }

    /**
     * Listen for events coming on the screen sharing event channel.
     *
     * @param {Object} event - Electron event data.
     * @param {Object} data - Channel specific data.
     */
    _onScreenSharingEvent(event, { data }) {
        switch (data.name) {
            case SCREEN_SHARE_EVENTS.OPEN_TRACKER:
                this._createScreenShareTracker();
                break;
            case SCREEN_SHARE_EVENTS.CLOSE_TRACKER:
                if (this._screenShareTracker) {
                    this._screenShareTracker.close();
                    this._screenShareTracker = undefined;
                }
                break;
            case SCREEN_SHARE_EVENTS.STOP_SCREEN_SHARE:
                this._jitsiMeetWindow.webContents.send(SCREEN_SHARE_EVENTS_CHANNEL, { data });
                break;
            default:
                console.warn(`Unhandled ${SCREEN_SHARE_EVENTS_CHANNEL}: ${data}`);
        }
    }

    /**
     * Opens an always on top window, in the bottom center of the screen, that lets a user know
     * a content sharing session is currently active.
     *
     * @return {void}
     */
    _createScreenShareTracker() {
        if (this._screenShareTracker) {
            return;
        }

        // Display always on top screen sharing tracker window in the center bottom of the screen.
        let display = screen.getPrimaryDisplay();
        this._screenShareTracker = new BrowserWindow({
            height: TRACKER_SIZE.height,
            width: TRACKER_SIZE.width,
            x:(display.bounds.width - TRACKER_SIZE.width) / 2,
            y:display.bounds.height - TRACKER_SIZE.height - 10,
            transparent: true,
            minimizable: true,
            maximizable: false,
            resizable: false,
            alwaysOnTop: true,
            fullscreen: false,
            fullscreenable: false,
            skipTaskbar: true,
            frame: false,
            show: false,
            webPreferences: {
                nodeIntegration: true
            }
        });

        // Prevent newly created window to take focus from main application.
        this._screenShareTracker.once('ready-to-show', () => {
            if (this._screenShareTracker && !this._screenShareTracker.isDestroyed()) {
                this._screenShareTracker.showInactive();
            }
        });

        this._screenShareTracker.sharingIdentity = this._identity;
        // eslint-disable-next-line no-undef
        this._screenShareTracker.loadURL(`file://${__dirname}/screenSharingTracker.html?`);
    }
}

/**
 * Initializes the screen sharing electron specific functionality in the main electron process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which displays Jitsi Meet
 * @param {string} identity - Name of the application doing screen sharing, will be displayed in the
 * screen sharing tracker window text i.e. {identity} is sharing your screen.
 */
module.exports = function setupScreenSharingMain(jitsiMeetWindow, identity) {
    return new ScreenShareMainHook(jitsiMeetWindow, identity);
};