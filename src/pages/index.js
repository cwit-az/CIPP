import Head from "next/head";
import { useEffect, useState } from "react";
import { Box, Container, Button, Card, CardContent, Tooltip } from "@mui/material";
import { Grid } from "@mui/system";
import { CippInfoBar } from "../components/CippCards/CippInfoBar";
import { CippChartCard } from "../components/CippCards/CippChartCard";
import { CippPropertyListCard } from "../components/CippCards/CippPropertyListCard";
import { Layout as DashboardLayout } from "../layouts/index.js";
import { useSettings } from "../hooks/use-settings";
import { getCippFormatting } from "../utils/get-cipp-formatting.js";
import Portals from "../data/portals";
import { BulkActionsMenu } from "../components/bulk-actions-menu.js";
import { CippUniversalSearch } from "../components/CippCards/CippUniversalSearch.jsx";
import { ApiGetCall } from "../api/ApiCall.jsx";
import { CippCopyToClipBoard } from "../components/CippComponents/CippCopyToClipboard.jsx";
import { ExecutiveReportButton } from "../components/ExecutiveReportButton.js";
import { CippStandardsDialog } from "../components/CippCards/CippStandardsDialog.jsx";

const Page = () => {
  const { currentTenant } = useSettings();
  const [domainVisible, setDomainVisible] = useState(false);
  const [standardsDialogOpen, setStandardsDialogOpen] = useState(false);

  const organization = ApiGetCall({
    url: "/api/ListOrg",
    queryKey: `${currentTenant}-ListOrg`,
    data: { tenantFilter: currentTenant },
  });

  const dashboard = ApiGetCall({
    url: "/api/ListuserCounts",
    data: { tenantFilter: currentTenant },
    queryKey: `${currentTenant}-ListuserCounts`,
  });

  const GlobalAdminList = ApiGetCall({
    url: "/api/ListGraphRequest",
    queryKey: `${currentTenant}-ListGraphRequest`,
    data: {
      tenantFilter: currentTenant,
      Endpoint: "/directoryRoles(roleTemplateId='62e90394-69f5-4237-9190-012177145e10')/members",
      $select: "displayName,userPrincipalName,accountEnabled",
    },
  });

  const sharepoint = ApiGetCall({
    url: "/api/ListSharepointQuota",
    queryKey: `${currentTenant}-ListSharepointQuota`,
    data: { tenantFilter: currentTenant },
  });

  const standards = ApiGetCall({
    url: "/api/ListStandardTemplates",
    queryKey: `${currentTenant}-ListStandardTemplates`,
  });

  const partners = ApiGetCall({
    url: "/api/ListGraphRequest",
    queryKey: `${currentTenant}-ListPartners`,
    data: {
      Endpoint: "policies/crossTenantAccessPolicy/partners",
      tenantFilter: currentTenant,
      ReverseTenantLookup: true,
    },
  });

  const currentTenantInfo = ApiGetCall({
    url: "/api/ListTenants",
    queryKey: `ListTenants`,
  });

  // Top bar data
  const tenantInfo = [
    { name: "Tenant Name", data: organization.data?.displayName },
    {
      name: "Tenant ID",
      data: (
        <>
          <CippCopyToClipBoard text={organization.data?.id} type="chip" />
        </>
      ),
    },
    {
      name: "Default Domain",
      data: (
        <>
          <CippCopyToClipBoard
            text={
              organization.data?.verifiedDomains?.find((domain) => domain.isDefault === true)?.name
            }
            type="chip"
          />
        </>
      ),
    },
    {
      name: "AD Sync Enabled",
      data: getCippFormatting(organization.data?.onPremisesSyncEnabled, "dirsync"),
    },
  ];

  function getActionCountsForTenant(standardsData, currentTenant) {
    if (!standardsData) {
      return {
        remediateCount: 0,
        alertCount: 0,
        reportCount: 0,
        total: 0,
      };
    }

    const applicableTemplates = standardsData.filter((template) => {
      const tenantFilterArr = Array.isArray(template?.tenantFilter) ? template.tenantFilter : [];
      const excludedTenantsArr = Array.isArray(template?.excludedTenants)
        ? template.excludedTenants
        : [];

      const tenantInFilter =
        tenantFilterArr.length > 0 && tenantFilterArr.some((tf) => tf.value === currentTenant);

      const allTenantsTemplate =
        tenantFilterArr.some((tf) => tf.value === "AllTenants") &&
        (excludedTenantsArr.length === 0 ||
          !excludedTenantsArr.some((et) => et.value === currentTenant));

      return tenantInFilter || allTenantsTemplate;
    });

    // Combine standards from all applicable templates:
    let combinedStandards = {};
    for (const template of applicableTemplates) {
      for (const [standardKey, standardValue] of Object.entries(template.standards)) {
        combinedStandards[standardKey] = standardValue;
      }
    }

    // Count each action type:
    let remediateCount = 0;
    let alertCount = 0;
    let reportCount = 0;

    for (const [, standard] of Object.entries(combinedStandards)) {
      let actions = standard.action || [];
      if (!Array.isArray(actions)) {
        actions = [actions];
      }
      actions.forEach((actionObj) => {
        if (actionObj?.value === "Remediate") {
          remediateCount++;
        } else if (actionObj?.value === "Alert") {
          alertCount++;
        } else if (actionObj?.value === "Report") {
          reportCount++;
        }
      });
    }

    const total = Object.keys(combinedStandards).length;

    return { remediateCount, alertCount, reportCount, total };
  }

  const { remediateCount, alertCount, reportCount, total } = getActionCountsForTenant(
    standards.data,
    currentTenant
  );

  const [PortalMenuItems, setPortalMenuItems] = useState([]);

  const formatStorageSize = (sizeInMB) => {
    if (sizeInMB >= 1024) {
      return `${(sizeInMB / 1024).toFixed(2)}GB`;
    }
    return `${sizeInMB}MB`;
  };

  useEffect(() => {
    if (currentTenantInfo.isSuccess) {
      const tenantLookup = currentTenantInfo.data?.find(
        (tenant) => tenant.defaultDomainName === currentTenant
      );
      const menuItems = Portals.map((portal) => ({
        label: portal.label,
        target: "_blank",
        link: portal.url.replace(portal.variable, tenantLookup?.[portal.variable]),
        icon: portal.icon,
      }));
      setPortalMenuItems(menuItems);
    }
  }, [currentTenantInfo.isSuccess, currentTenant]);

  return (
    <>
      <Head>
        <title>Dashboard</title>
      </Head>
      <Box sx={{ flexGrow: 1, py: 4 }}>
        <Container maxWidth={false}>
          <Grid container spacing={3}>
            <Grid size={{ md: 12, xs: 12 }}>
              <Card>
                <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, p: 2 }}>
                  <BulkActionsMenu
                    buttonName="Portals"
                    actions={PortalMenuItems}
                    disabled={!currentTenantInfo.isSuccess}
                  />
                  <ExecutiveReportButton
                    tenantName={organization.data?.displayName}
                    tenantId={organization.data?.id}
                    userStats={{
                      licensedUsers: dashboard.data?.LicUsers || 0,
                      unlicensedUsers: dashboard.data?.Users && dashboard.data?.LicUsers && GlobalAdminList.data?.Results && dashboard.data?.Guests
                        ? dashboard.data?.Users - dashboard.data?.LicUsers - dashboard.data?.Guests - GlobalAdminList.data?.Results?.length
                        : 0,
                      guests: dashboard.data?.Guests || 0,
                      globalAdmins: GlobalAdminList.data?.Results?.length || 0
                    }}
                    standardsData={standards.data}
                    organizationData={organization.data}
                    disabled={organization.isFetching || dashboard.isFetching}
                  />
                  <Box sx={{ flex: 1 }}>
                    {/* TODO: Remove Card from inside CippUniversalSearch to avoid double border */}
                    <CippUniversalSearch />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ md: 12, xs: 12 }}>
              <CippInfoBar data={tenantInfo} isFetching={organization.isFetching} />
            </Grid>
            <Grid size={{ md: 4, xs: 12 }}>
              <CippChartCard
                title="User Statistics"
                isFetching={dashboard.isFetching || GlobalAdminList.isFetching}
                chartType="pie"
                chartSeries={[
                  Number(dashboard.data?.LicUsers || 0),
                  dashboard.data?.Users &&
                  dashboard.data?.LicUsers &&
                  GlobalAdminList.data?.Results &&
                  dashboard.data?.Guests
                    ? Number(
                        dashboard.data?.Users -
                          dashboard.data?.LicUsers -
                          dashboard.data?.Guests -
                          GlobalAdminList.data?.Results?.length
                      )
                    : 0,
                  Number(dashboard.data?.Guests || 0),
                  Number(GlobalAdminList.data?.Results?.length || 0),
                ]}
                labels={["Licensed Users", "Unlicensed Users", "Guests", "Global Admins"]}
              />
            </Grid>

            <Grid size={{ md: 4, xs: 12 }}>
              <Tooltip title="Click to view standards">
                <CippChartCard
                  title="Standards Set"
                  isFetching={standards.isFetching}
                  chartType="bar"
                  chartSeries={[remediateCount, alertCount, reportCount]}
                  labels={["Remediation", "Alert", "Report"]}
                  onClick={() => setStandardsDialogOpen(true)}
                />
              </Tooltip>
            </Grid>

            <Grid size={{ md: 4, xs: 12 }}>
              <CippChartCard
                title="SharePoint Quota"
                isFetching={sharepoint.isFetching}
                chartType="donut"
                chartSeries={[
                  Number(sharepoint.data?.TenantStorageMB - sharepoint.data?.GeoUsedStorageMB) || 0,
                  Number(sharepoint.data?.GeoUsedStorageMB) || 0,
                ]}
                labels={[
                  `Free (${formatStorageSize(
                    sharepoint.data?.TenantStorageMB - sharepoint.data?.GeoUsedStorageMB
                  )})`,
                  `Used (${formatStorageSize(sharepoint.data?.GeoUsedStorageMB)})`,
                ]}
              />
            </Grid>

            {/* Converted Domain Names to Property List */}
            <Grid size={{ md: 4, xs: 12 }}>
              <CippPropertyListCard
                title="Domain Names"
                showDivider={false}
                copyItems={true}
                isFetching={organization.isFetching}
                propertyItems={organization.data?.verifiedDomains
                  ?.slice(0, domainVisible ? undefined : 3)
                  .map((domain, idx) => ({
                    label: "",
                    value: domain.name,
                  }))}
                actionButton={
                  organization.data?.verifiedDomains?.length > 3 && (
                    <Button onClick={() => setDomainVisible(!domainVisible)}>
                      {domainVisible ? "See less" : "See more..."}
                    </Button>
                  )
                }
              />
            </Grid>

            <Grid size={{ md: 4, xs: 12 }}>
              <CippPropertyListCard
                showDivider={false}
                copyItems={true}
                title="Partner Relationships"
                isFetching={partners.isFetching}
                propertyItems={partners.data?.Results.map((partner, idx) => ({
                  label: partner.TenantInfo?.displayName,
                  value: partner.TenantInfo?.defaultDomainName,
                }))}
              />
            </Grid>

            <Grid size={{ md: 4, xs: 12 }}>
              <CippPropertyListCard
                copyItems={true}
                showDivider={false}
                title="Tenant Capabilities"
                isFetching={organization.isFetching}
                propertyItems={[
                  {
                    label: "Services",
                    value: organization.data?.assignedPlans
                      ?.filter(
                        (plan) =>
                          plan.capabilityStatus === "Enabled" &&
                          ["exchange", "AADPremiumService", "WindowsDefenderATP"].includes(
                            plan.service
                          )
                      )
                      .reduce((uniqueServices, curr) => {
                        const serviceLabel =
                          curr.service === "exchange"
                            ? "Exchange"
                            : curr.service === "AADPremiumService"
                            ? "AAD Premium"
                            : curr.service === "Windows Defender"
                            ? "Windows Defender"
                            : curr.service;

                        if (!uniqueServices.includes(serviceLabel)) {
                          uniqueServices.push(serviceLabel);
                        }
                        return uniqueServices;
                      }, [])
                      .join(", "),
                  },
                ]}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>
      
      <CippStandardsDialog
        open={standardsDialogOpen}
        onClose={() => setStandardsDialogOpen(false)}
        standardsData={standards.data}
        currentTenant={currentTenant}
      />
    </>
  );
};

Page.getLayout = (page) => <DashboardLayout allTenantsSupport={false}>{page}</DashboardLayout>;

export default Page;
