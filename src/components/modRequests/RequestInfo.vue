<template>
    <modal-dialog
        id="modRequestDetail"
        :title="fullTitle"
    >
        <div v-if="selectedRequest" class="container">
            <span class="text-secondary">
                Only accept/deny a request if you looked at the map and have a reason for your choice!
            </span>
            <div class="row">
                <div class="col-sm-7">
                    <textarea
                        v-model.trim="reviewComment"
                        class="form-control"
                        placeholder="comment (optional)"
                        rows="3"
                    />
                </div>
                <div class="col-sm-5 form-inline justify-content-around">
                    <div class="form-check">
                        <input
                            id="denied"
                            v-model="reviewAction"
                            value="denied"
                            type="radio"
                            class="form-check-input"
                        >
                        <label class="form-check-label" for="denied">Denied</label>
                    </div>
                    <div class="form-check">
                        <input
                            id="accepted"
                            v-model="reviewAction"
                            value="accepted"
                            type="radio"
                            class="form-check-input"
                        >
                        <label class="form-check-label" for="accepted">Accepted</label>
                    </div>
                    <button class="btn btn-primary" @click="submitReview($event)">
                        Save
                    </button>
                </div>
            </div>

            <hr>

            <b>Submitted:</b>
            <div class="row mb-2 text-secondary">
                <div class="col-sm-12">
                    {{ selectedRequest.createdAt | toStandardDate }}
                </div>
            </div>


            <template v-if="selectedRequest.comment">
                <b>Mapper's comment:</b>
                <div class="row mb-2 text-secondary">
                    <div class="col-sm-12">
                        {{ selectedRequest.comment }}
                    </div>
                </div>
            </template>

            <template v-if="selectedRequest.beatmapset.events.length">
                <b>Related events:</b>
                <div class="row mb-2 text-secondary">
                    <div class="col-sm-12">
                        <div v-for="event in selectedRequest.beatmapset.events" :key="event._id">
                            {{ event.timestamp | toStandardDate }}: {{ event.type }}
                        </div>
                    </div>
                </div>
            </template>

            <hr>

            <b>Reviews:</b>
            <div v-for="review in selectedRequest.modReviews" :key="review.id" class="row text-secondary">
                <div class="col-sm-2">
                    {{ review.updatedAt | toStandardDate }}
                </div>
                <div class="col-sm-2">
                    <user-link
                        :osu-id="review.user.osuId"
                        :username="review.user.username"
                    />
                </div>
                <div class="col-sm-2 text-capitalize" :class="review.action == 'accepted' ? 'text-success' : 'text-warning'">
                    {{ review.action }}
                </div>
                <div class="col-sm-6 text-break">
                    {{ review.comment }}
                </div>
            </div>
        </div>
    </modal-dialog>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import ModalDialog from '../ModalDialog.vue';
import UserLink from '../UserLink.vue';

export default {
    name: 'RequestInfo',
    components: {
        ModalDialog,
        UserLink,
    },
    data () {
        return {
            reviewAction: '',
            reviewComment: '',
        };
    },
    computed: {
        ...mapState('modRequests', [
            'selectedRequestId',
            'monthsLimit',
        ]),
        ...mapGetters('modRequests', [
            'selectedRequest',
            'userReview',
        ]),
        /** @returns {string} */
        fullTitle () {
            if (this.selectedRequest) {
                return this.selectedRequest.beatmapset.fullTitle;
            }

            return '';
        },
    },
    watch: {
        userReview (review) {
            this.reviewAction = (review && review.action) || '';
            this.reviewComment = (review && review.comment) || '';
        },
    },
    methods: {
        async submitReview (e) {
            if (this.reviewComment && this.reviewComment.length > 500) {
                this.$store.dispatch('updateToastMessages', {
                    message: 'Comment cannot be longer than 500 characters, consider modding it if you need more',
                    type: 'info',
                });

                return;
            }

            await this.$http.executePost(`/modRequests/listing/${this.selectedRequestId}/review`, {
                action: this.reviewAction,
                comment: this.reviewComment,
            }, e);

            const [all, involved] = await Promise.all([
                this.$http.executeGet(`/modRequests/listing/all?limit=${this.monthsLimit}`),
                this.$http.executeGet('/modRequests/listing/involved'),
            ]);
            if (!all.error) this.$store.commit('modRequests/setAllRequests', all);
            if (!involved.error) this.$store.commit('modRequests/setInvolvedRequests', involved);
        },
    },
};
</script>
