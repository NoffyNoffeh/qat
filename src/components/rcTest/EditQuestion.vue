<template>
    <modal-dialog
        id="editQuestion"
        title="Editing question"
    >
        <div v-if="selectedQuestion" class="container">
            <question-type
                v-model="questionType"
                :for-label="'edit'"
            />

            <question-content
                v-model="questionContent"
            />

            <div class="text-right">
                <button type="submit" class="btn btn-sm btn-success ml-2" @click="updateQuestion($event)">
                    Update Question
                </button>

                <button
                    type="submit"
                    class="btn btn-sm ml-2"
                    :class="selectedQuestion.active ? 'btn-danger' : 'btn-success'"
                    data-toggle="tooltip"
                    data-placement="top"
                    title="Changes whether or not question appears on newly generated tests"
                    @click="toggleActivity($event)"
                >
                    {{ selectedQuestion.active ? "Mark as inactive" : "Mark as active" }}
                </button>
            </div>
            <hr>

            <edit-options />
        </div>
    </modal-dialog>
</template>

<script>
import { mapGetters } from 'vuex';
import ModalDialog from '../../components/ModalDialog.vue';
import EditOptions from './EditOptions.vue';
import QuestionType from './QuestionType.vue';
import QuestionContent from './QuestionContent.vue';

export default {
    name: 'EditQuestion',
    components: {
        ModalDialog,
        QuestionType,
        QuestionContent,
        EditOptions,
    },
    data() {
        return {
            questionContent: '',
            questionType: '',
        };
    },
    computed: mapGetters('manageTest', [
        'selectedQuestion',
    ]),
    watch: {
        selectedQuestion (q) {
            if (!q) return;

            this.questionContent = q.content;
            this.questionType = q.questionType;
        },
    },
    methods: {
        async updateQuestion (e) {
            if (!this.questionContent || !this.questionType) {
                this.$store.dispatch('updateToastMessages', {
                    message: `Cannot leave question fields blank!`,
                    type: 'danger',
                });
            } else {
                const data = await this.$http.executePost(`/manageTest/${this.selectedQuestion.id}/update`, {
                    questionType: this.questionType,
                    newQuestion: this.questionContent,
                }, e);

                if (this.$http.isValid(data)) {
                    this.$store.commit('manageTest/updateQuestion', data.question);
                }
            }
        },
        async toggleActivity(e) {
            const data = await this.$http.executePost(`/manageTest/${this.selectedQuestion.id}/toggleActivity`, {}, e);

            if (this.$http.isValid(data)) {
                this.$store.commit('manageTest/updateQuestion', data.question);
            }
        },
    },
};
</script>
