const LitElement = Object.getPrototypeOf(
    customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

Date.prototype.getWeekNumber = function () {
    var d = new Date(+this);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    return Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 8.64e7) + 1) / 7);
};

class PronoteTimetableCard extends LitElement {

    lunchBreakRendered = false;

    static get properties() {
        return {
            config: {},
            hass: {}
        };
    }

    getCardHeader() {
        let child_sensor = this.config.entity.split('_timetable')[0];
        let child_attributes = this.hass.states[child_sensor].attributes;
        let child_name = (typeof child_attributes['nickname'] === 'string' && child_attributes['nickname'] !== '') ? child_attributes['nickname'] : child_attributes['full_name'];
        return html`<div class="pronote-card-header">Emploi du temps de ${child_name}</div>`;
    }

    getBreakRow(label, ended) {
        return html`
        <tr class="lunch-break ${ended ? 'lesson-ended' : ''}">
            <td></td>
            <td><span></span></td>
            <td colspan="2">
                <span class="lesson-name">${label}</span>
            </td>
        </tr>`;
    }

    getTimetableRow(lesson) {
        let currentDate = new Date();
        let startAt = Date.parse(lesson.start_at);
        let endAt = Date.parse(lesson.end_at);

        let prefix = html``;
        if (this.config.display_lunch_break && lesson.is_afternoon && !this.lunchBreakRendered) {
            prefix = this.getBreakRow('Repas', this.config.dim_ended_lessons && startAt < currentDate);
            this.lunchBreakRendered = true;
        }

        let content = html`
        <tr class="${lesson.canceled ? 'lesson-canceled':''} ${this.config.dim_ended_lessons && endAt < currentDate ? 'lesson-ended' : ''}">
            <td>
                ${lesson.start_time}<br />
                ${lesson.end_time}
            </td>
            <td><span style="background-color:${lesson.background_color}"></span></td>
            <td>
                <span class="lesson-name">${lesson.lesson}</span>
                ${this.config.display_classroom ? html`<span class="lesson-classroom">
                    ${lesson.classroom ? 'Salle '+lesson.classroom : ''}
                    ${lesson.classroom && this.config.display_teacher ? ', ' : '' }
                </span>` : '' }
                ${this.config.display_teacher ? html`<span class="lesson-teacher">
                    ${lesson.teacher_name}
                </span>`: '' }
            </td>
            <td>
                ${lesson.status ? html`<span class="lesson-status">${lesson.status}</span>`:''}
            </td>
        </tr>
        `
        return html`${prefix}${content}`;
    }

    getFormattedDate(lesson) {
        return (new Date(lesson.start_at))
            .toLocaleDateString('fr-FR', {weekday: 'long', day: '2-digit', month: '2-digit'})
            .replace(/^(.)/, (match) => match.toUpperCase())
        ;
    }

    getFormattedTime(time) {
        return new Intl.DateTimeFormat("fr-FR", {hour:"numeric", minute:"numeric"}).format(new Date(time));
    }

    getDayHeader(firstLesson, dayStartAt, dayEndAt) {
        return html`<div class="pronote-timetable-header">
            <span>${this.getFormattedDate(firstLesson)}</span>
            ${this.config.display_day_hours && dayStartAt && dayEndAt ? html`<span class="pronote-timetable-header-hours">
                ${this.getFormattedTime(dayStartAt)} - ${this.getFormattedTime(dayEndAt)}
            </span>` : '' }
        </div>`;
    }

    render() {
        if (!this.config || !this.hass) {
            return html``;
        }

        const stateObj = this.hass.states[this.config.entity];

        const lessons = this.hass.states[this.config.entity].attributes['lessons']
        const day_start_at = this.hass.states[this.config.entity].attributes['day_start_at']
        const day_end_at = this.hass.states[this.config.entity].attributes['day_end_at']

        if (stateObj) {
            this.lunchBreakRendered = false;

            let latestLessonDay = this.getFormattedDate(lessons[0]);
            const currentWeekNumber = new Date().getWeekNumber();

            const itemTemplates = [];
            let dayTemplates = [];
            let daysCount = 1;
            itemTemplates.push(this.getDayHeader(lessons[0], day_start_at, day_end_at));

            for (let index = 0; index < lessons.length; index++) {
                let lesson = lessons[index];
                let currentFormattedDate = this.getFormattedDate(lesson);

                if (lesson.canceled && index < lessons.length - 1) {
                    let nextLesson = lessons[index + 1];
                    if (lesson.start_at === nextLesson.start_at && !nextLesson.canceled) {
                        continue;
                    }
                }

                if (this.config.current_week_only) {
                    if (new Date(lesson.start_at).getWeekNumber() > currentWeekNumber) {
                        break;
                    }
                }

                if (latestLessonDay !== currentFormattedDate) {
                    itemTemplates.push(html`<table>${dayTemplates}</table>`);
                    dayTemplates = [];

                    daysCount++;
                    if (this.config.max_days && this.config.max_days < daysCount) {
                        break;
                    }

                    itemTemplates.push(this.getDayHeader(lesson));

                    this.lunchBreakRendered = false;
                    latestLessonDay = currentFormattedDate;
                }

                dayTemplates.push(this.getTimetableRow(lesson));
            }
            itemTemplates.push(html`<table>${dayTemplates}</table>`);

            return html`
                <ha-card id="${this.config.entity}-card">
                    ${this.config.display_header ? this.getCardHeader() : ''}
                    ${itemTemplates}
                </ha-card>`
            ;
        }
    }

    setConfig(config) {
        if (!config.entity) {
            throw new Error('You need to define an entity');
        }

        const defaultConfig = {
            entity: null,
            display_header: true,
            display_lunch_break: true,
            display_classroom: true,
            display_teacher: true,
            display_day_hours: true,
            dim_ended_lessons: true,
            max_days: null,
            current_week_only: false,
        }

        this.config = {
            ...defaultConfig,
            ...config
        };
    }

    static get styles() {
        return css`
        .pronote-card-header {
            text-align:center;
        }
        div {
            padding: 12px;
            font-weight:bold;
            font-size:1em;
        }
        span.pronote-timetable-header-hours {
            float:right;
        }
        table{
            clear:both;
            font-size: 0.9em;
            font-family: Roboto;
            width: 100%;
            outline: 0px solid #393c3d;
            border-collapse: collapse;
        }
        tr:nth-child(odd) {
            background-color: rgba(0,0,0,0.1);
        }
        td {
            vertical-align: middle;
            padding: 5px 10px 5px 10px;
            text-align: left;
        }
        tr td:first-child {
            width: 13%;
            text-align:right;
        }
        span.lesson-name {
            font-weight:bold;
            display:block;
        }
        tr td:nth-child(2) {
            width: 4px;
            padding: 5px 0;
        }
        tr td:nth-child(2) > span {
            display:inline-block;
            width: 4px;
            height: 3rem;
            border-radius:4px;
            background-color: grey;
            margin-top:4px;
        }
        span.lesson-status {
            color: white;
            background-color: rgb(75, 197, 253);
            padding: 4px;
            border-radius: 4px;
        }
        .lesson-canceled span.lesson-name {
            text-decoration: line-through;
        }
        .lesson-canceled span.lesson-status {
            background-color: rgb(250, 50, 75);
        }
        .lesson-ended {
            opacity: 0.3;
        }
        table + div {
            border-top: 1px solid white;
        }
        `;
    }
}

customElements.define("pronote-timetable-card", PronoteTimetableCard);
