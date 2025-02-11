<template>
    <div class="row">
        <div class="col-sm-12">
            <filter-box
                :placeholder="'enter to search beatmap...'"
                :options="['osu', 'taiko', 'catch', 'mania']"
                store-module="qualityAssurance"
            />

            <handbook />

            <leaderboard />

            <section class="card card-body">
                <transition-group name="list" tag="div">
                    <event-row
                        v-for="event in filteredEvents"
                        :key="event.id"
                        :event="event"
                        :is-outdated="isOutdated(event.beatmapsetId, event.timestamp)"
                    />
                </transition-group>

                <div class="text-center">
                    <button
                        class="btn btn-sm btn-primary mt-4 mx-auto"
                        data-toggle="tooltip"
                        data-placement="top"
                        title="show 200 more events throughout all modes"
                        @click="loadMore($event)"
                    >
                        <i class="fas fa-angle-down mr-1" /> show more <i class="fas fa-angle-down ml-1" />
                    </button>
                </div>
            </section>
        </div>

        <toast-messages />
    </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import qualityAssuranceModule from '../store/qualityAssurance';
import ToastMessages from '../components/ToastMessages.vue';
import FilterBox from '../components/FilterBox.vue';
import EventRow from '../components/qualityAssurance/EventRow.vue';
import Handbook from '../components/qualityAssurance/Handbook.vue';
import Leaderboard from '../components/qualityAssurance/Leaderboard.vue';

export default {
    name: 'QualityAssurancePage',
    components: {
        ToastMessages,
        FilterBox,
        EventRow,
        Handbook,
        Leaderboard,
    },
    data() {
        return {
            limit: 200,
        };
    },
    computed: {
        ...mapState([
            'loggedInUser',
        ]),
        ...mapGetters([
            'userMainMode',
        ]),
        ...mapState('qualityAssurance', [
            'events',
            'overwriteEvents',
        ]),
        ...mapGetters('qualityAssurance', [
            'filteredEvents',
        ]),
    },
    beforeCreate () {
        if (!this.$store.hasModule('qualityAssurance')) {
            this.$store.registerModule('qualityAssurance', qualityAssuranceModule);
        }
    },
    async created() {
        this.$store.commit('qualityAssurance/pageFilters/setFilterMode', this.userMainMode);
        const data = await this.$http.initialRequest('/qualityAssurance/relevantInfo');

        if (this.$http.isValid(data)) {
            this.$store.commit('qualityAssurance/setEvents', data.events);
            this.$store.commit('qualityAssurance/setOverwriteEvents', data.overwrite);
        }
    },
    mounted() {
        setInterval(async () => {
            const data = await this.$http.executeGet('/qualityAssurance/relevantInfo');

            if (this.$http.isValid(data)) {
                this.$store.commit('qualityAssurance/setEvents', data.events);
                this.$store.commit('qualityAssurance/setOverwriteEvents', data.overwrite);
            }
        }, 600000);
    },
    methods: {
        isOutdated (beatmapsetId, timestamp) {
            timestamp = new Date(timestamp);

            let date = new Date();
            date.setDate(date.getDate() - 10); // 10 is estimate of longest days count for qualified map queue

            if (timestamp < date) {
                return true;
            }

            let beatmaps = this.filteredEvents.filter(b => b.beatmapsetId == beatmapsetId && b.timestamp != timestamp);
            beatmaps = beatmaps.concat(this.overwriteEvents.filter(b => b.beatmapsetId == beatmapsetId));
            let isOutdated = false;

            for (const beatmap of beatmaps) {
                if (new Date(beatmap.timestamp) > timestamp) {
                    isOutdated = true;
                    break;
                }
            }

            return isOutdated;
        },
        async loadMore (e) {
            const res = await this.$http.executeGet('/qualityAssurance/loadMore/' + this.limit + '/' + (this.limit - 200), e);

            if (res) {
                this.$store.commit('qualityAssurance/addEvents', res.events);
                this.limit += 200;
            }
        },
    },
};
</script>
