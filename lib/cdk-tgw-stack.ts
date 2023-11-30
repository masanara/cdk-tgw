import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct, ConstructOrder } from 'constructs';

const app = new cdk.App()
const NamePrefix = 'demo'
const BgpAsn = 65005
const VpcCidr = '192.168.0.0/16'
const TgwCidr = '172.18.1.0/24'

export class CdkTgwStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const Vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: NamePrefix+'-vpc',
      ipAddresses: ec2.IpAddresses.cidr(VpcCidr),
      createInternetGateway: false,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: NamePrefix,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ]
    });

    // Reference
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.CfnTransitGateway.html
    //
    const TransitGateway = new ec2.CfnTransitGateway(this, 'TransitGateway', {
      amazonSideAsn: BgpAsn,
      autoAcceptSharedAttachments: 'disable',
      defaultRouteTableAssociation: 'disable',
      defaultRouteTablePropagation: 'disable',
      description: 'NOS Transit Gateway',
      dnsSupport: 'enable',
      multicastSupport: 'disable',
      tags: [{
        key: 'Name',
        value: NamePrefix+'tgw',
      }],
      transitGatewayCidrBlocks: [ TgwCidr ],
      vpnEcmpSupport: 'enable',
    });

    const vpcSubnets = Vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED
    })

    const TransitGatewayAttachment = new ec2.CfnTransitGatewayAttachment(this, 'TransitGatewayAttachment', {
      transitGatewayId: TransitGateway.ref,
      vpcId: Vpc.vpcId,
      subnetIds: vpcSubnets.subnetIds
    });

    const TransitGatewayConnect = new ec2.CfnTransitGatewayConnect(this, 'TransitGatewayConnect', {
      options: { protocol: 'gre', },
      transportTransitGatewayAttachmentId: TransitGatewayAttachment.ref,
    
      tags: [{
        key: 'key',
        value: 'value',
      }],
    });

    // Reference
    // https://github.com/aws-samples/aws-transit-gateway-egress-vpc-pattern/blob/master/lib/egress_vpc-tg-demo-stack.ts
    //
    const TransitGatewayRouteTable = new ec2.CfnTransitGatewayRouteTable(this, "TGRouteTable", {
      transitGatewayId: TransitGateway.ref,
      tags: [{
        key: 'Name',
        value: NamePrefix+"Route Domain",
      }],
    }); 

    const TransitGatewayRoute = new ec2.CfnTransitGatewayRoute(this, "TransitGatewayToDx", {
      transitGatewayRouteTableId: TransitGatewayRouteTable.ref,
      transitGatewayAttachmentId: TransitGatewayAttachment.ref,
      destinationCidrBlock: "0.0.0.0/0"
    });

    const TGRouteTableAssociationEgressVPC = new ec2.CfnTransitGatewayRouteTableAssociation(this, 'Egress_TG_Association', {
      transitGatewayAttachmentId: TransitGatewayAttachment.ref,
      transitGatewayRouteTableId: TransitGatewayRouteTable.ref,
    });

  }
}
