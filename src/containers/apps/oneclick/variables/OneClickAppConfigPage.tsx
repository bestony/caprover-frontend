import { Card, Col, Row } from 'antd'
import ReactMarkdown from 'react-markdown'
import { RouteComponentProps } from 'react-router'
import gfm from 'remark-gfm'
import ProjectSelector from '../../../../components/ProjectSelector'
import { IOneClickTemplate } from '../../../../models/IOneClickAppModels'
import ProjectDefinition from '../../../../models/ProjectDefinition'
import ErrorFactory from '../../../../utils/ErrorFactory'
import { localize } from '../../../../utils/Language'
import Toaster from '../../../../utils/Toaster'
import Utils from '../../../../utils/Utils'
import ApiComponent from '../../../global/ApiComponent'
import CenteredSpinner from '../../../global/CenteredSpinner'
import {
    ONE_CLICK_APP_STRINGIFIED_KEY,
    TEMPLATE_ONE_CLICK_APP,
} from '../selector/OneClickAppSelector'
import OneClickVariablesSection from './OneClickVariablesSection'

export const ONE_CLICK_APP_NAME_VAR_NAME = '$$cap_appname'
export const ONE_CLICK_ROOT_DOMAIN_VAR_NAME = '$$cap_root_domain'
export const ONE_CLICK_PROJECT_ID_VAR_NAME = '$$cap_project_id'

// Query parameter constants for deployment page
export const DEPLOYMENT_QUERY_PARAM_TEMPLATE = 'template'
export const DEPLOYMENT_QUERY_PARAM_VALUES_ARRAY = 'valuesArray'
export const DEPLOYMENT_QUERY_PARAM_APP_NAME = 'appName'
export const DEPLOYMENT_QUERY_PARAM_PROJECT_ID = 'projectId'

export default class OneClickAppConfigPage extends ApiComponent<
    RouteComponentProps<any>,
    {
        apiData: IOneClickTemplate | undefined
        rootDomain: string
        projects: ProjectDefinition[]
        selectedProjectId: string
    }
> {
    private isUnmount: boolean = false

    constructor(props: any) {
        super(props)
        this.state = {
            apiData: undefined,
            rootDomain: '',
            projects: [],
            selectedProjectId: '',
        }
    }

    componentWillUnmount() {
        // @ts-ignore
        if (super.componentWillUnmount) super.componentWillUnmount()
        this.isUnmount = true
    }

    componentDidMount() {
        const self = this

        const appNameFromPath = this.props.match.params.appName
        const qs = new URLSearchParams(self.props.location.search)
        const baseDomainFromPath = qs.get('baseDomain')
        let promiseToFetchOneClick =
            appNameFromPath === TEMPLATE_ONE_CLICK_APP
                ? new Promise<any>(function (resolve) {
                      resolve(
                          JSON.parse(
                              qs.get(ONE_CLICK_APP_STRINGIFIED_KEY) as string
                          )
                      )
                  })
                : self.apiManager
                      .getOneClickAppByName(
                          appNameFromPath,
                          baseDomainFromPath as string
                      )
                      .then(function (data) {
                          return data.appTemplate
                      })

        let apiData: IOneClickTemplate

        promiseToFetchOneClick
            .then(function (data: IOneClickTemplate) {
                return JSON.parse(
                    Utils.replaceAllGenRandomForOneClickApp(
                        JSON.stringify(data)
                    )
                ) as IOneClickTemplate
            })
            .then(function (data: IOneClickTemplate) {
                if (`${data.captainVersion}` !== '4') {
                    throw ErrorFactory.createError(
                        ErrorFactory.ILLEGAL_PARAMETER,
                        `One-click app version is ${data.captainVersion}, this version supports "v4". Make sure your CapRover is up-to-date with the latest version!!`
                    )
                }

                data.caproverOneClickApp.variables =
                    data.caproverOneClickApp.variables || []
                // Adding app name to all one click apps
                data.caproverOneClickApp.variables.unshift({
                    id: ONE_CLICK_APP_NAME_VAR_NAME,
                    label: 'App Name',
                    description:
                        'This is your app name. Pick a name such as my-first-1-click-app',
                    validRegex: '/^([a-z0-9]+\\-)*[a-z0-9]+$/', // string version of /^([a-z0-9]+\-)*[a-z0-9]+$/
                })

                apiData = data

                return Promise.all([
                    self.apiManager.getCaptainInfo(),
                    self.apiManager.getAllProjects(),
                ])
            })
            .then(function ([captainInfo, projectsResponse]) {
                self.setState({
                    apiData: apiData,
                    rootDomain: captainInfo.rootDomain,
                    projects: projectsResponse.projects || [],
                })
            })
            .catch(Toaster.createCatcher())
    }

    renderProjectSelector() {
        const self = this

        if ((self.state.projects || []).length === 0) {
            return undefined
        }

        return (
            <div style={{ marginBottom: 40 }}>
                <h4>{localize('apps.parent_project', 'Parent project')}</h4>
                <div
                    style={{ paddingBottom: 5, fontSize: '90%' }}
                    className="hide-on-demand"
                />
                <Row>
                    <Col xs={{ span: 24 }} lg={{ span: 12 }}>
                        <ProjectSelector
                            allProjects={self.state.projects}
                            selectedProjectId={self.state.selectedProjectId}
                            onChange={(value: string) => {
                                self.setState({
                                    selectedProjectId: value,
                                })
                            }}
                            excludeProjectId={'NONE'}
                        />
                    </Col>
                </Row>
            </div>
        )
    }

    render() {
        const self = this
        const apiData = this.state.apiData
        const displayName =
            apiData && apiData.caproverOneClickApp.displayName
                ? apiData.caproverOneClickApp.displayName
                : self.props.match.params.appName[0].toUpperCase() +
                  self.props.match.params.appName.slice(1)

        if (!apiData) {
            return <CenteredSpinner />
        }

        return (
            <div>
                <Row justify="center">
                    <Col xs={{ span: 23 }} lg={{ span: 16 }}>
                        <Card title={`Setup your ${displayName}`}>
                            <h2>{displayName}</h2>
                            <div
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    paddingLeft: 15,
                                    paddingRight: 15,
                                }}
                            >
                                <ReactMarkdown remarkPlugins={[gfm]}>
                                    {
                                        apiData.caproverOneClickApp.instructions
                                            .start
                                    }
                                </ReactMarkdown>
                            </div>
                            <div style={{ height: 40 }} />
                            {self.renderProjectSelector()}
                            <OneClickVariablesSection
                                oneClickAppVariables={
                                    apiData.caproverOneClickApp.variables
                                }
                                onNextClicked={(values) => {
                                    const template = Utils.copyObject(
                                        self.state.apiData!
                                    )
                                    const valuesAugmented =
                                        Utils.copyObject(values)

                                    template.caproverOneClickApp.variables.push(
                                        {
                                            id: ONE_CLICK_ROOT_DOMAIN_VAR_NAME,
                                            label: 'CapRover root domain',
                                        }
                                    )
                                    valuesAugmented[
                                        ONE_CLICK_ROOT_DOMAIN_VAR_NAME
                                    ] = self.state.rootDomain

                                    // Carry selected project through values so deploy works
                                    // even when the API client does not yet have a projectId field.
                                    valuesAugmented[
                                        ONE_CLICK_PROJECT_ID_VAR_NAME
                                    ] = self.state.selectedProjectId || ''

                                    const valuesArray = Object.keys(
                                        valuesAugmented
                                    ).map((key) => {
                                        return {
                                            key: key,
                                            value: valuesAugmented[key],
                                        }
                                    })

                                    // Navigate to deployment page with template and values
                                    const templateStr = encodeURIComponent(
                                        JSON.stringify(template)
                                    )
                                    const valuesArrayStr = encodeURIComponent(
                                        JSON.stringify(valuesArray)
                                    )
                                    const appName = encodeURIComponent(
                                        self.props.match.params.appName
                                    )
                                    const projectId = encodeURIComponent(
                                        self.state.selectedProjectId || ''
                                    )

                                    const deployUrl = `/apps/oneclick/deployment?${DEPLOYMENT_QUERY_PARAM_TEMPLATE}=${templateStr}&${DEPLOYMENT_QUERY_PARAM_VALUES_ARRAY}=${valuesArrayStr}&${DEPLOYMENT_QUERY_PARAM_APP_NAME}=${appName}&${DEPLOYMENT_QUERY_PARAM_PROJECT_ID}=${projectId}`
                                    self.props.history.push(deployUrl)
                                }}
                            />
                        </Card>
                    </Col>
                </Row>
            </div>
        )
    }
}
